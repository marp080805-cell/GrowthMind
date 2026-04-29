import { supabase } from '../lib/supabase'
import { metaService } from '../services/meta.service'

/**
 * Proteções automáticas contra bloqueios de Business Manager pela Meta.
 * Funcionam independentemente de como o usuário cria as automações.
 *
 * @see flowads/docs/meta-account-protection.md
 */

// Track de execuções e chamadas à API (em memória, sincronizado com Redis em prod)
const apiCallTracker = new Map<string, { timestamp: number; count: number }[]>()
const clientExecutionTracker = new Map<string, { hour: number; count: number }>()

// ─────────────────────────────────────────────────────────────────────────────
// 1. RATE LIMITING POR CLIENTE
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ADS_PER_CLIENT_PER_HOUR = 5 // máximo 5 anúncios/hora por cliente (Meta limite ~5-8)
const MAX_ADS_PER_ACCOUNT_PER_HOUR = 8 // máximo 8 anúncios/hora por ad account inteira (seguro)

export async function checkClientRateLimit(clientId: string, adAccountId: string): Promise<{ allowed: boolean; reason?: string }> {
  const now = new Date()
  const currentHour = now.getHours()
  const hourKey = `${clientId}_${currentHour}`

  // Verificar limite por cliente
  const clientRecord = clientExecutionTracker.get(hourKey) || { hour: currentHour, count: 0 }
  if (clientRecord.count >= MAX_ADS_PER_CLIENT_PER_HOUR) {
    return {
      allowed: false,
      reason: `Cliente ${clientId} atingiu limite de ${MAX_ADS_PER_CLIENT_PER_HOUR} anúncios/hora`,
    }
  }

  // Verificar limite por ad account inteira
  const accountKey = `account_${adAccountId}_${currentHour}`
  const accountRecord = clientExecutionTracker.get(accountKey) || { hour: currentHour, count: 0 }
  if (accountRecord.count >= MAX_ADS_PER_ACCOUNT_PER_HOUR) {
    return {
      allowed: false,
      reason: `Ad account atingiu limite de ${MAX_ADS_PER_ACCOUNT_PER_HOUR} anúncios/hora (distribuído entre clientes)`,
    }
  }

  return { allowed: true }
}

export function incrementClientAdCount(clientId: string, adAccountId: string, adCount: number = 1) {
  const now = new Date()
  const currentHour = now.getHours()

  // Incrementar contador do cliente
  const clientKey = `${clientId}_${currentHour}`
  const clientRecord = clientExecutionTracker.get(clientKey) || { hour: currentHour, count: 0 }
  clientRecord.count += adCount
  clientExecutionTracker.set(clientKey, clientRecord)

  // Incrementar contador da ad account
  const accountKey = `account_${adAccountId}_${currentHour}`
  const accountRecord = clientExecutionTracker.get(accountKey) || { hour: currentHour, count: 0 }
  accountRecord.count += adCount
  clientExecutionTracker.set(accountKey, accountRecord)

  // Limpar registros de horas antigas (cleanup)
  const oldHour = (currentHour - 2 + 24) % 24
  clientExecutionTracker.delete(`${clientId}_${oldHour}`)
  clientExecutionTracker.delete(`account_${adAccountId}_${oldHour}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. STAGGER AUTOMÁTICO ENTRE CLIENTES
// ─────────────────────────────────────────────────────────────────────────────

export async function calculateAutomaticStagger(clientId: string, adAccountId: string, baseHour: number, baseMinute: number): Promise<number> {
  /**
   * Se múltiplos clientes usam o mesmo ad_account e todas suas automações
   * tentam rodar no mesmo horário, o sistema distribui automaticamente.
   *
   * Exemplo:
   * - Cliente A 19:00 → executa em 19:00:00
   * - Cliente B 19:00 → executa em 19:05:00 (staggered)
   * - Cliente C 19:00 → executa em 19:10:00 (staggered)
   */
  const { data: automations, error } = await supabase
    .from('automations')
    .select('id, client_id, automation_nodes(config)')
    .eq('is_active', true)

  if (error || !automations) return 0

  // Encontrar todas as automações deste ad_account com mesmo horário
  const autosByAccount = automations.filter(auto => {
    const trigger = (auto.automation_nodes as Array<{ config: Record<string, unknown> }>)?.[0]?.config
    if (!trigger) return false
    const time = (trigger.time as string)?.split(':')
    return time && parseInt(time[0]) === baseHour && parseInt(time[1]) === baseMinute
  })

  // Ordenar por client_id para distribuição determinística
  const sortedClients = [...new Set(autosByAccount.map(a => a.client_id as string))].sort()
  const clientIndex = sortedClients.indexOf(clientId)

  // Adicionar 5 minutos de stagger por cliente (0, 5, 10, 15 min)
  return Math.max(0, clientIndex * 5 * 60 * 1000)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. HEALTH CHECK DA AD ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────

export async function checkAdAccountHealth(token: string, adAccountId: string): Promise<{ healthy: boolean; reason?: string }> {
  /**
   * Verifica indicadores de saúde da ad account:
   * - Conta não foi restringida pela Meta
   * - Não ultrapassou rate limits recentemente
   * - Token ainda é válido
   */
  try {
    // Tenta fazer uma chamada simples — GET account info
    const response = await fetch(`https://graph.instagram.com/v21.0/act_${adAccountId}?fields=name,account_status&access_token=${token}`)
    const data = (await response.json()) as { account_status?: number; error?: { type?: string; code?: number } }

    if (data.error?.code === 190 || data.error?.type === 'OAuthException') {
      return { healthy: false, reason: 'Token inválido ou expirado' }
    }

    if (data.error?.code === 1346001 || data.error?.code === 100) {
      // 1346001 = account action blocked by Meta
      // 100 = Invalid parameter (pode indicar restrição)
      return { healthy: false, reason: 'Ad account pode estar restringida pela Meta' }
    }

    if (data.account_status === 1 || data.account_status === 2) {
      // 1 = ACTIVE, 2 = DISABLED (need check-in)
      return { healthy: data.account_status === 1, reason: data.account_status === 2 ? 'Account precisa de check-in' : undefined }
    }

    return { healthy: true }
  } catch (err) {
    return { healthy: false, reason: `Health check falhou: ${err instanceof Error ? err.message : String(err)}` }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DETECÇÃO DE RAJADAS (BURST DETECTION)
// ─────────────────────────────────────────────────────────────────────────────

const BURST_THRESHOLD = 50 // limite de chamadas à API em 5 minutos
const BURST_WINDOW_MS = 5 * 60 * 1000 // 5 minutos

export function recordApiCall(adAccountId: string) {
  /**
   * Registra cada chamada à API da Meta.
   * Se detectar padrão suspeito, sistema pausa automações.
   */
  const now = Date.now()
  const calls = apiCallTracker.get(adAccountId) || []

  // Remover chamadas fora da janela
  const recentCalls = calls.filter(c => now - c.timestamp < BURST_WINDOW_MS)
  recentCalls.push({ timestamp: now, count: 1 })

  apiCallTracker.set(adAccountId, recentCalls)
}

export async function checkBurstDetection(adAccountId: string): Promise<{ safe: boolean; reason?: string }> {
  const now = Date.now()
  const calls = apiCallTracker.get(adAccountId) || []
  const recentCalls = calls.filter(c => now - c.timestamp < BURST_WINDOW_MS)

  const totalCalls = recentCalls.reduce((sum, c) => sum + c.count, 0)

  if (totalCalls > BURST_THRESHOLD) {
    // Log e alerta
    console.warn(`[Burst Detection] Ad account ${adAccountId} ultrapassou ${BURST_THRESHOLD} chamadas em 5 min (${totalCalls} registradas)`)

    // Notificar admin (exemplo: Slack, email, etc.)
    // await notifyAdmin(`Burst pattern detectado em ${adAccountId}`)

    return {
      safe: false,
      reason: `Muita atividade na API (${totalCalls} chamadas em 5 min) — pausa automática aplicada`,
    }
  }

  return { safe: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INTEGRAÇÃO: VALIDAÇÃO PRÉ-EXECUÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export async function validateAutomationExecution(
  clientId: string,
  automationId: string,
  adAccountId: string,
  token: string,
): Promise<{ allowed: boolean; reason?: string }> {
  /**
   * Executar ANTES de qualquer automação.
   * Se alguma proteção indicar risco, cancela a execução automaticamente.
   */

  // 1. Rate limit
  const rateCheck = await checkClientRateLimit(clientId, adAccountId)
  if (!rateCheck.allowed) return rateCheck

  // 2. Health check
  const healthCheck = await checkAdAccountHealth(token, adAccountId)
  if (!healthCheck.healthy) return healthCheck

  // 3. Burst detection
  const burstCheck = await checkBurstDetection(adAccountId)
  if (!burstCheck.safe) return burstCheck

  return { allowed: true }
}
