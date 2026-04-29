/**
 * Monitor de Saúde de Ad Account
 * Verifica periodicamente se account foi restringida pela Meta
 * Para automações automaticamente se detectar restrição
 */

import cron from 'node-cron'
import { supabase } from '../lib/supabase'
import { MetaService } from '../services/meta.service'
import { queueManager } from './account-queue-manager'

const CHECK_INTERVAL = '*/5 * * * *' // A cada 5 minutos

export interface AccountHealthStatus {
  adAccountId: string
  status: 'healthy' | 'warning' | 'restricted'
  lastCheck: Date
  error?: string
}

const healthCache = new Map<string, AccountHealthStatus>()

/**
 * Iniciar monitor de saúde
 */
export function startHealthMonitor(): void {
  console.log('[Health Monitor] Iniciando verificações periódicas (a cada 5 min)')

  cron.schedule(CHECK_INTERVAL, async () => {
    try {
      await performHealthCheck()
    } catch (err) {
      console.error('[Health Monitor] Erro ao verificar saúde:', err)
    }
  })
}

/**
 * Executar verificação de saúde para todos os accounts
 */
async function performHealthCheck(): Promise<void> {
  // Buscar todos os accounts únicos
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, ad_account_id, meta_token')
    .not('ad_account_id', 'is', null)

  if (error || !clients) {
    console.error('[Health Monitor] Erro ao buscar clients:', error)
    return
  }

  const accountIds = [...new Set(
    clients.map(c => c.ad_account_id).filter(Boolean)
  )]

  console.log(`[Health Monitor] Verificando saúde de ${accountIds.length} accounts`)

  for (const accountId of accountIds) {
    const client = clients.find(c => c.ad_account_id === accountId)
    if (!client?.meta_token) continue

    try {
      const health = await checkAccountHealth(accountId as string, client.meta_token)
      await handleHealthStatus(accountId as string, health)
    } catch (err) {
      console.error(`[Health Monitor] Erro ao verificar account ${accountId}:`, err)
    }
  }
}

/**
 * Verificar saúde de um account específico
 */
async function checkAccountHealth(
  adAccountId: string,
  token: string
): Promise<AccountHealthStatus> {
  const lastCheck = new Date()

  try {
    const meta = new MetaService(token, adAccountId)

    // Fazer requisição simples para verificar se token é válido
    // e se account não foi restringida
    const url = `https://graph.facebook.com/v21.0/act_${adAccountId}?fields=name,account_status&access_token=${token}`

    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const data = (await response.json()) as {
      account_status?: number
      error?: { code?: number; message?: string; type?: string }
    }

    // Análise de erros da Meta
    if (data.error) {
      const { code, message, type } = data.error

      // Erro 1346001: Account foi restringida
      if (code === 1346001 || message?.includes('restricted')) {
        return {
          adAccountId,
          status: 'restricted',
          lastCheck,
          error: `Meta Error ${code}: ${message}`,
        }
      }

      // Erro 190: Token inválido
      if (code === 190 || type === 'OAuthException') {
        return {
          adAccountId,
          status: 'warning',
          lastCheck,
          error: 'Token inválido ou expirado',
        }
      }

      // Outros erros
      return {
        adAccountId,
        status: 'warning',
        lastCheck,
        error: `Meta Error ${code}: ${message}`,
      }
    }

    // Account status: 1=ACTIVE, 2=DISABLED, 3=RESTRICTED
    if (data.account_status === 2 || data.account_status === 3) {
      return {
        adAccountId,
        status: 'warning',
        lastCheck,
        error: `Account status: ${data.account_status === 2 ? 'DISABLED' : 'RESTRICTED'}`,
      }
    }

    // Tudo OK
    return {
      adAccountId,
      status: 'healthy',
      lastCheck,
    }
  } catch (err) {
    return {
      adAccountId,
      status: 'warning',
      lastCheck,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Tratar resultado de health check
 */
async function handleHealthStatus(adAccountId: string, health: AccountHealthStatus): Promise<void> {
  const previousHealth = healthCache.get(adAccountId)
  healthCache.set(adAccountId, health)

  const statusChanged = previousHealth?.status !== health.status

  if (statusChanged) {
    console.log(
      `[Health Monitor] Account ${adAccountId}: ${previousHealth?.status || 'unknown'} → ${health.status}` +
        (health.error ? ` (${health.error})` : '')
    )
  }

  // Atualizar no queue manager
  await queueManager.setAccountHealth(adAccountId, health.status)

  // Se account ficou restringida, alertar
  if (health.status === 'restricted') {
    await alertAccountRestriction(adAccountId, health.error)
  }

  // Salvar no banco para auditoria
  await supabase.from('account_health_log').insert({
    ad_account_id: adAccountId,
    status: health.status,
    error: health.error,
    checked_at: new Date().toISOString(),
  })
}

/**
 * Alertar que account foi restringida
 */
async function alertAccountRestriction(adAccountId: string, error?: string): Promise<void> {
  console.error(`[ALERT] Account ${adAccountId} foi RESTRINGIDA pela Meta!`)
  console.error(`Razão: ${error}`)

  // TODO: Enviar notificação ao admin (email, Slack, SMS, etc)
  // await sendAlert(`Account ${adAccountId} foi restringida: ${error}`)

  // Parar automações para essa account
  await supabase
    .from('automations')
    .update({ is_active: false })
    .eq('client_id', (
      await supabase
        .from('clients')
        .select('id')
        .eq('ad_account_id', adAccountId)
        .single()
    ).data?.id)

  console.log(`[Health Monitor] Automações pausadas para account ${adAccountId}`)
}

/**
 * Obter status de saúde em cache
 */
export function getAccountHealthStatus(adAccountId: string): AccountHealthStatus | undefined {
  return healthCache.get(adAccountId)
}

/**
 * Obter todos os statuses
 */
export function getAllHealthStatuses(): AccountHealthStatus[] {
  return Array.from(healthCache.values())
}

/**
 * Forçar verificação imediata
 */
export async function forceHealthCheck(): Promise<void> {
  console.log('[Health Monitor] Verificação forçada')
  await performHealthCheck()
}
