/**
 * Worker que processa jobs da fila
 * Garante: 1 job por vez por account, delays realistas, retry seguro
 */

import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { supabase } from '../lib/supabase'
import { MetaService } from '../services/meta.service'
import { queueManager, type MetaQueueJob } from './account-queue-manager'

// Redis separado para armazenar resultados (ioredis direto, não BullMQ)
const redisResults = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// BullMQ v5 precisa de options {host, port}, não de instância Redis
function parseRedisConnection(url: string) {
  try {
    const u = new URL(url)
    return { host: u.hostname, port: parseInt(u.port || '6379'), password: u.password || undefined, maxRetriesPerRequest: null as null }
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null as null }
  }
}
const bullmqConnection = parseRedisConnection(process.env.REDIS_URL || 'redis://localhost:6379')

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
  const safeAccountId = adAccountId.replace(/:/g, "-").replace(/^act_/, "")
  const queueName = `meta-account-${safeAccountId}`

  const worker = new Worker(
    queueName,
    async (job: Job<MetaQueueJob>) => {
      return await processMetaJob(job, adAccountId)
    },
    {
      connection: bullmqConnection,
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
 * Armazena resultado em Redis para que executor possa recuperar
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

    const response = { success: true, result }

    // 7. Salvar resultado em Redis para executor recuperar
    const resultKey = `job:result:${job.id}`
    await redisResults.setex(resultKey, 3600, JSON.stringify(response))
    console.log(`[Queue Worker] Resultado salvo em Redis: ${resultKey}`)

    return response
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Queue Worker] ✗ ${action} failed: ${errMsg}`)

    const response = { success: false, error: errMsg }

    // Armazenar erro também
    await job.updateProgress({ status: 'error', data: response })

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
      return await meta.createCampaign({
        name: payload.name as string,
        objective: payload.objective as string,
        status: (payload.status as string) || 'PAUSED',
        daily_budget: payload.daily_budget as number | undefined,
        lifetime_budget: payload.lifetime_budget as number | undefined,
        start_time: payload.start_time as string | undefined,
        stop_time: payload.stop_time as string | undefined,
        special_ad_categories: payload.special_ad_categories as string[] | undefined,
      })

    case 'create_adset':
      return await meta.createAdSet({
        campaign_id: payload.campaign_id as string,
        name: (payload.name as string) || 'Conjunto de anúncios',
        optimization_goal: (payload.optimization_goal as string) || 'REACH',
        billing_event: (payload.billing_event as string) || 'IMPRESSIONS',
        targeting: (payload.targeting as Record<string, unknown>) || { geo_locations: { countries: ['BR'] } },
        daily_budget: payload.daily_budget as number | undefined,
        lifetime_budget: payload.lifetime_budget as number | undefined,
        status: (payload.status as string) || 'PAUSED',
        start_time: payload.start_time as string | undefined,
        end_time: payload.end_time as string | undefined,
      })

    case 'create_ad': {
      // Suporte para criar ad a partir de Instagram post
      if (payload.source_instagram_media_id) {
        return await meta.createAdFromInstagramPost({
          postId: payload.source_instagram_media_id as string,
          instagramAccountId: payload.instagram_user_id as string | undefined,
          pageId: payload.page_id as string | undefined,
          adsetId: payload.adset_id as string,
          adName: payload.name as string,
          status: (payload.status as string) || 'PAUSED',
          destinationUrl: payload.destination_url as string | undefined,
        })
      }

      // Ad regular com criativo
      return await meta.createAd({
        adset_id: payload.adset_id as string,
        name: payload.name as string,
        creative_id: payload.creative_id as string | undefined,
        title: payload.title as string | undefined,
        body: payload.body as string | undefined,
        image_url: payload.image_url as string | undefined,
        image_hash: payload.image_hash as string | undefined,
        video_id: payload.video_id as string | undefined,
        thumbnail_hash: payload.thumbnail_hash as string | undefined,
        link_url: payload.link_url as string | undefined,
        call_to_action: payload.call_to_action as string | undefined,
        page_id: payload.page_id as string | undefined,
        instagram_user_id: payload.instagram_user_id as string | undefined,
        status: (payload.status as string) || 'PAUSED',
      })
    }

    case 'edit_campaign':
      return await meta.editCampaign(
        payload.campaign_id as string,
        {
          name: payload.name as string | undefined,
          status: payload.status as string | undefined,
          daily_budget: payload.daily_budget as number | undefined,
          lifetime_budget: payload.lifetime_budget as number | undefined,
          stop_time: payload.stop_time as string | undefined,
        }
      )

    case 'edit_adset':
      return await meta.editAdSet(
        payload.adset_id as string,
        {
          name: payload.name as string | undefined,
          status: payload.status as string | undefined,
          daily_budget: payload.daily_budget as number | undefined,
          targeting: payload.targeting as Record<string, unknown> | undefined,
          end_time: payload.end_time as string | undefined,
        }
      )

    case 'edit_ad':
      return await meta.editAd(
        payload.ad_id as string,
        {
          name: payload.name as string | undefined,
          status: payload.status as string | undefined,
          creative_id: payload.creative_id as string | undefined,
        }
      )

    case 'adjust_budget':
      return await meta.updateBudget(
        payload.object_id as string,
        {
          daily_budget: payload.daily_budget as number | undefined,
          lifetime_budget: payload.lifetime_budget as number | undefined,
        }
      )

    case 'pause_ad':
      return await meta.pauseObject(payload.object_id as string)

    case 'activate_ad':
      return await meta.activateObject(payload.object_id as string)

    case 'delete_object':
      return await meta.deleteObject(payload.object_id as string)

    case 'boost_post':
      return await meta.boostPost({
        post_id: payload.post_id as string,
        page_id: payload.page_id as string,
        daily_budget: (payload.daily_budget as number) || 10,
        duration_days: (payload.duration_days as number) || 7,
        targeting: payload.targeting as Record<string, unknown> || { geo_locations: { countries: ['BR'] }, age_min: 18, age_max: 65 },
        optimization_goal: payload.optimization_goal as string | undefined,
      })

    case 'duplicate_campaign':
      return await meta.duplicateCampaign(
        payload.campaign_id as string,
        payload.new_name as string | undefined
      )

    case 'create_audience':
      return await meta.createCustomAudience({
        name: payload.name as string,
        description: payload.description as string | undefined,
        subtype: (payload.subtype as 'CUSTOM' | 'WEBSITE' | 'APP' | 'LOOKALIKE') || 'WEBSITE',
        pixel_id: payload.pixel_id as string | undefined,
        rule: payload.rule as Record<string, unknown> | undefined,
        lookalike_spec: payload.lookalike_spec as Record<string, unknown> | undefined,
      })

    case 'upload_creative': {
      if (payload.type === 'image') {
        const imageUrl = payload.image_url as string
        const imageRes = await fetch(imageUrl)
        const imageBytes = Buffer.from(await imageRes.arrayBuffer())
        return await meta.uploadAdImage(imageBytes)
      } else if (payload.type === 'video') {
        const videoUrl = payload.video_url as string
        const videoRes = await fetch(videoUrl, { signal: AbortSignal.timeout(300_000) })
        const videoBytes = Buffer.from(await videoRes.arrayBuffer())
        const videoName = (payload.name as string) || 'video.mp4'
        const mimeType = (payload.mime_type as string) || 'video/mp4'
        return await meta.uploadAdVideo(videoBytes, videoName, mimeType)
      }
      throw new Error('Tipo de criativo desconhecido')
    }

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
  await redisResults.quit()
  console.log('[Queue Workers] Encerrado')
}
