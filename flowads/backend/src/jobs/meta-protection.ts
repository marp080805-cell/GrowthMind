import { supabase } from '../lib/supabase'

// Redis para persistência de rate limiting entre workers
let redis: any = null
try {
  const Redis = require('redis')
  redis = Redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' })
  redis.connect().catch(() => { redis = null; console.warn('[Rate Limiting] Redis não disponível, usando memória') })
} catch {
  console.warn('[Rate Limiting] Redis não disponível, usando memória')
}

/**
 * Proteções automáticas contra bloqueios de Business Manager pela Meta.
 * Funcionam independentemente de como o usuário cria as automações.
 *
 * @see flowads/docs/meta-account-protection.md
 */

// Track de execuções e chamadas à API (em memória, sincronizado com Redis em prod)
const apiCallTracker = new Map<string, { timestamp: number; count: number }[]>()
const clientExecutionTracker = new Map<string, { hour: number; count: number }>()

// Track de edições por objeto (campaignId, adsetId, adId, etc)
// Previne manipulação excessiva do mesmo objeto
const objectEditTracker = new Map<string, { date: string; count: number }>()

// Track de duplicações de campanha
// Previne criação em massa de campanhas duplicadas
const campaignDuplicationTracker = new Map<string, { date: string; count: number }>()

// ─────────────────────────────────────────────────────────────────────────────
// 1. RATE LIMITING POR CLIENTE
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ADS_PER_CLIENT_PER_HOUR = 5 // máximo 5 anúncios/hora por cliente (Meta limite ~5-8)
const MAX_ADS_PER_ACCOUNT_PER_HOUR = 8 // máximo 8 anúncios/hora por ad account inteira (seguro)

export async function checkClientRateLimit(clientId: string, adAccountId: string): Promise<{ allowed: boolean; reason?: string }> {
  const now = new Date()
  const currentHour = now.getHours()
  const hourKey = `rl:client:${clientId}:${currentHour}`
  const accountKey = `rl:account:${adAccountId}:${currentHour}`

  // Verificar limite por cliente (Redis ou memória)
  let clientCount = 0
  if (redis) {
    clientCount = parseInt(await redis.get(hourKey) || '0')
  } else {
    const record = clientExecutionTracker.get(hourKey)
    clientCount = record?.count || 0
  }

  if (clientCount >= MAX_ADS_PER_CLIENT_PER_HOUR) {
    return {
      allowed: false,
      reason: `Cliente atingiu limite de ${MAX_ADS_PER_CLIENT_PER_HOUR} anúncios/hora`,
    }
  }

  // Verificar limite por ad account
  let accountCount = 0
  if (redis) {
    accountCount = parseInt(await redis.get(accountKey) || '0')
  } else {
    const record = clientExecutionTracker.get(accountKey)
    accountCount = record?.count || 0
  }

  if (accountCount >= MAX_ADS_PER_ACCOUNT_PER_HOUR) {
    return {
      allowed: false,
      reason: `Ad account atingiu limite de ${MAX_ADS_PER_ACCOUNT_PER_HOUR} anúncios/hora`,
    }
  }

  return { allowed: true }
}

export async function incrementClientAdCount(clientId: string, adAccountId: string, adCount: number = 1) {
  const now = new Date()
  const currentHour = now.getHours()
  const hourKey = `rl:client:${clientId}:${currentHour}`
  const accountKey = `rl:account:${adAccountId}:${currentHour}`

  if (redis) {
    // Usar Redis com TTL de 1 hora
    await redis.incBy(hourKey, adCount)
    await redis.expire(hourKey, 3600)
    await redis.incBy(accountKey, adCount)
    await redis.expire(accountKey, 3600)
  } else {
    // Fallback para memória
    const clientRecord = clientExecutionTracker.get(hourKey) || { hour: currentHour, count: 0 }
    clientRecord.count += adCount
    clientExecutionTracker.set(hourKey, clientRecord)

    const accountRecord = clientExecutionTracker.get(accountKey) || { hour: currentHour, count: 0 }
    accountRecord.count += adCount
    clientExecutionTracker.set(accountKey, accountRecord)

    // Cleanup
    const oldHour = (currentHour - 2 + 24) % 24
    clientExecutionTracker.delete(`rl:client:${clientId}:${oldHour}`)
    clientExecutionTracker.delete(`rl:account:${adAccountId}:${oldHour}`)
  }
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
    const response = await fetch(`https://graph.facebook.com/v21.0/act_${adAccountId}?fields=name,account_status&access_token=${token}`)
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
// 4B. RATE LIMIT POR OBJETO (ANTI-MANIPULATION)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_EDITS_PER_OBJECT_PER_DAY = 3 // máximo 3 mudanças por dia (status, budget, etc.)

export function canEditObject(objectId: string): boolean {
  /**
   * Verifica se um objeto pode ser editado hoje (máx 3 edições/dia)
   * Objetos são: campaignId, adsetId, adId, etc.
   */
  const today = new Date().toISOString().split('T')[0]
  const key = `${objectId}_${today}`

  const record = objectEditTracker.get(key) || { date: today, count: 0 }
  return record.count < MAX_EDITS_PER_OBJECT_PER_DAY
}

export function recordObjectEdit(objectId: string) {
  /**
   * Registra uma edição no objeto
   */
  const today = new Date().toISOString().split('T')[0]
  const key = `${objectId}_${today}`

  const record = objectEditTracker.get(key) || { date: today, count: 0 }
  record.count++
  objectEditTracker.set(key, record)

  // Cleanup: remover registros de mais de 2 dias atrás
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 2)
  const cutoff = cutoffDate.toISOString().split('T')[0]

  for (const [k] of objectEditTracker) {
    if (k.endsWith(cutoff)) {
      objectEditTracker.delete(k)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4C. CAMPAIGN DUPLICATION RATE LIMIT
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DUPLICATIONS_PER_ORIGINAL_PER_DAY = 1 // máximo 1 cópia por campanha original/dia

export function canDuplicateCampaign(originalCampaignId: string): boolean {
  /**
   * Verifica se uma campanha pode ser duplicada
   * Meta proíbe padrão de duplicação em massa
   */
  const today = new Date().toISOString().split('T')[0]
  const key = `dup_${originalCampaignId}_${today}`

  const record = campaignDuplicationTracker.get(key) || { date: today, count: 0 }
  return record.count < MAX_DUPLICATIONS_PER_ORIGINAL_PER_DAY
}

export function recordCampaignDuplication(originalCampaignId: string) {
  /**
   * Registra uma duplicação de campanha
   */
  const today = new Date().toISOString().split('T')[0]
  const key = `dup_${originalCampaignId}_${today}`

  const record = campaignDuplicationTracker.get(key) || { date: today, count: 0 }
  record.count++
  campaignDuplicationTracker.set(key, record)

  // Cleanup
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 1)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  for (const [k] of campaignDuplicationTracker) {
    if (k.includes(`_${cutoffStr}`)) {
      campaignDuplicationTracker.delete(k)
    }
  }
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
  if (!healthCheck.healthy) return { allowed: false, reason: healthCheck.reason }

  // 3. Burst detection
  const burstCheck = await checkBurstDetection(adAccountId)
  if (!burstCheck.safe) return { allowed: false, reason: burstCheck.reason }

  return { allowed: true }
}
