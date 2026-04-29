/**
 * Worker que processa jobs da fila
 * Garante: 1 job por vez por account, delays realistas, retry seguro
 */

import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { supabase } from '../lib/supabase'
import { MetaService } from '../services/meta.service'
import { queueManager, type MetaQueueJob } from './account-queue-manager'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const redis = new Redis(redisUrl)

const DELAYS_BETWEEN_REQUESTS = {
  create_campaign: 5000, // 5s
  create_adset: 5000,
  create_ad: 3000,
  edit_campaign: 2000,
  edit_ad: 2000,
  pause_ad: 1000,
  activate_ad: 1000,
  upload_creative: 10000, // 10s para upload
}

/**
 * Factory para criar worker por account
 */
export function createAccountWorker(adAccountId: string): Worker {
  const queueName = `meta:account:${adAccountId}`

  const worker = new Worker(
    queueName,
    async (job: Job<MetaQueueJob>) => {
      return await processMetaJob(job, adAccountId)
    },
    {
      connection: redis,
      concurrency: 1, // ← CRÍTICO: 1 por vez
      lockDuration: 600_000, // 10 min lock
      lockRenewTime: 300_000, // Renovar a cada 5 min
    }
  )

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[Worker ${adAccountId}] Job completado: ${job.id}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[Worker ${adAccountId}] Job falhou: ${job?.id} - ${err.message}`)
  })

  worker.on('error', (err) => {
    console.error(`[Worker ${adAccountId}] Worker error: ${err.message}`)
  })

  return worker
}

/**
 * Processar um job Meta
 */
async function processMetaJob(job: Job<MetaQueueJob>, adAccountId: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const { automationId, clientId, action, payload, retries } = job.data

  try {
    console.log(`[Queue Worker] Processing ${action} for account ${adAccountId} (attempt ${retries + 1})`)

    // 1. Delay baseado na ação (humanizar timing)
    const delay = DELAYS_BETWEEN_REQUESTS[action as keyof typeof DELAYS_BETWEEN_REQUESTS] || 3000
    await new Promise(r => setTimeout(r, delay))

    // 2. Validar health da conta novamente
    const health = await queueManager.getAccountHealth(adAccountId)
    if (health === 'restricted') {
      throw new Error('Ad account está restringida pela Meta')
    }

    // 3. Buscar cliente e token
    const { data: client } = await supabase
      .from('clients')
      .select('*, settings:settings(*)')
      .eq('id', clientId)
      .single()

    if (!client) throw new Error(`Cliente ${clientId} não encontrado`)

    // 4. Executar ação Meta
    const result = await executeMetaAction(
      action,
      payload,
      client.meta_token || client.settings?.meta_token,
      adAccountId
    )

    // 5. Registrar execução para rate limit
    await queueManager.recordExecution(adAccountId, action)

    // 6. Log sucesso
    console.log(`[Queue Worker] ✓ ${action} succeeded for ${clientId}`)

    return { success: true, result }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Queue Worker] ✗ ${action} failed: ${errMsg}`)

    // Verificar se é erro de conta restringida
    if (errMsg.includes('1346001') || errMsg.includes('restricted')) {
      await queueManager.setAccountHealth(adAccountId, 'restricted')
      throw new Error('Ad account foi restringida pela Meta - parando automações')
    }

    // Re-throw para retry automático do BullMQ
    throw err
  }
}

/**
 * Executar ação Meta específica
 */
async function executeMetaAction(
  action: string,
  payload: Record<string, unknown>,
  token: string,
  adAccountId: string
): Promise<unknown> {
  const meta = new MetaService(token, adAccountId)

  switch (action) {
    case 'create_campaign':
      return await meta.createCampaign(
        payload.name as string,
        payload.objective as string,
        payload.daily_budget as number | undefined
      )

    case 'create_adset':
      return await meta.createAdSet(
        payload.campaign_id as string,
        payload.targeting as Record<string, unknown>,
        payload.daily_budget as number | undefined
      )

    case 'create_ad':
      return await meta.createAd({
        adset_id: payload.adset_id as string,
        name: payload.name as string,
        creative_id: payload.creative_id as string | undefined,
        status: (payload.status as string) || 'PAUSED',
      })

    case 'edit_campaign':
      return await meta.editCampaign(
        payload.campaign_id as string,
        payload as Record<string, unknown>
      )

    case 'edit_ad':
      return await meta.editAd(
        payload.ad_id as string,
        payload as Record<string, unknown>
      )

    case 'pause_ad':
      return await meta.pauseObject(payload.object_id as string)

    case 'activate_ad':
      return await meta.activateObject(payload.object_id as string)

    case 'upload_creative':
      if (payload.type === 'image') {
        return await meta.uploadAdImage(
          payload.image_url as string,
          payload.page_id as string
        )
      } else if (payload.type === 'video') {
        return await meta.uploadAdVideo(
          payload.video_url as string,
          payload.page_id as string
        )
      }
      throw new Error('Tipo de criativo desconhecido')

    default:
      throw new Error(`Ação desconhecida: ${action}`)
  }
}

/**
 * Inicializar workers para todos os accounts
 */
export async function initializeQueueWorkers(): Promise<Map<string, Worker>> {
  const workers = new Map<string, Worker>()

  // Buscar todos os accounts únicos
  const { data: clients } = await supabase
    .from('clients')
    .select('ad_account_id')
    .not('ad_account_id', 'is', null)

  const accountIds = [...new Set(
    (clients || []).map(c => c.ad_account_id).filter(Boolean)
  )]

  console.log(`[Queue Workers] Inicializando ${accountIds.length} workers`)

  for (const accountId of accountIds) {
    const worker = createAccountWorker(accountId as string)
    workers.set(accountId as string, worker)
    console.log(`  ✓ Worker para account ${accountId}`)
  }

  return workers
}

/**
 * Graceful shutdown
 */
export async function shutdownQueueWorkers(workers: Map<string, Worker>): Promise<void> {
  console.log('[Queue Workers] Encerrando...')
  for (const worker of workers.values()) {
    await worker.close()
  }
  await redis.quit()
  console.log('[Queue Workers] Encerrado')
}
