import { Queue, Worker } from 'bullmq'

const META_API = 'https://graph.facebook.com/v21.0'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

function parseRedisConnection(url: string) {
  try {
    const u = new URL(url)
    return {
      host: u.hostname,
      port: parseInt(u.port || '6379'),
      password: u.password || undefined,
      maxRetriesPerRequest: null as null,
    }
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null as null }
  }
}

interface AdActivationJobData {
  adId: string       // ID do ad PAUSED criado inicialmente (para deletar)
  token: string
  attemptLabel: string
  creativeId: string // ID do creative já criado (reutilizado no novo ad ACTIVE)
  adsetId: string
  adName: string
  adAccountId: string
}

let adActivationQueue: Queue | null = null

export function scheduleAdActivation(
  adId: string,
  token: string,
  delayMs = 5 * 60 * 1000,
  meta?: { creativeId: string; adsetId: string; adName: string; adAccountId: string }
) {
  if (!adActivationQueue) {
    console.warn(`[AdActivation] Queue não inicializada — usando setTimeout fallback para ad ${adId}`)
    if (meta) {
      setTimeout(() => recreateAdAsActive(adId, token, meta, 'setTimeout-fallback'), delayMs)
    }
    return
  }

  const jobData: AdActivationJobData = {
    adId,
    token,
    attemptLabel: '5min',
    creativeId: meta?.creativeId ?? '',
    adsetId: meta?.adsetId ?? '',
    adName: meta?.adName ?? '',
    adAccountId: meta?.adAccountId ?? '',
  }

  adActivationQueue.add('activate', jobData, {
    delay: delayMs,
    attempts: 3,
    backoff: { type: 'fixed', delay: 15 * 60 * 1000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  }).then(() => {
    console.log(`[AdActivation] Job agendado: ad ${adId} recriado como ACTIVE em ${delayMs / 60000}min`)
  }).catch((err) => {
    console.error(`[AdActivation] Erro ao agendar job para ad ${adId}:`, err)
    if (meta) setTimeout(() => recreateAdAsActive(adId, token, meta, 'setTimeout-fallback'), delayMs)
  })
}

// Deleta o ad PAUSED e recria diretamente como ACTIVE usando o mesmo creative.
// Isso evita a transição PAUSED→ACTIVE via Graph API, que dispara validação
// mais restrita do que o path interno do Ads Manager (addraft_publish_statuses).
async function recreateAdAsActive(
  pausedAdId: string,
  token: string,
  meta: { creativeId: string; adsetId: string; adName: string; adAccountId: string },
  label: string
) {
  console.log(`[AdActivation] Recriando ad ${pausedAdId} como ACTIVE [${label}]...`)

  // Deletar o ad PAUSED (best-effort — pode já ter sido deletado em retries)
  try {
    const delRes = await fetch(`${META_API}/${pausedAdId}?access_token=${token}`, { method: 'DELETE' })
    const delData = await delRes.json() as Record<string, unknown>
    if (delRes.ok || delData.success) {
      console.log(`[AdActivation] Ad PAUSED ${pausedAdId} deletado`)
    } else {
      console.warn(`[AdActivation] Delete de ${pausedAdId} retornou:`, JSON.stringify(delData))
    }
  } catch (e) {
    console.warn(`[AdActivation] Falha ao deletar ad ${pausedAdId} (ignorando):`, e)
  }

  // Criar novo ad diretamente como ACTIVE — path "create-and-publish", sem transição de estado
  const formData = new URLSearchParams({
    adset_id: meta.adsetId,
    name: meta.adName,
    creative: JSON.stringify({ creative_id: meta.creativeId }),
    status: 'ACTIVE',
    access_token: token,
  })

  const createRes = await fetch(`${META_API}/act_${meta.adAccountId}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })

  const createData = await createRes.json() as Record<string, unknown> & { error?: { message?: string; code?: number } }

  if (!createRes.ok || createData.error) {
    const errMsg = createData.error?.message || JSON.stringify(createData)
    console.error(`[AdActivation] Falha ao criar ad ACTIVE [${label}]:`, errMsg)
    throw new Error(errMsg)
  }

  const newAdId = createData.id as string
  console.log(`[AdActivation] Ad ACTIVE criado: ${newAdId} (substituiu PAUSED ${pausedAdId}) [${label}]`)
}

export function initAdActivationWorker() {
  const connection = parseRedisConnection(redisUrl)

  adActivationQueue = new Queue('ad-activations', { connection })

  const worker = new Worker<AdActivationJobData>(
    'ad-activations',
    async (job) => {
      const { adId, token, attemptLabel, creativeId, adsetId, adName, adAccountId } = job.data
      const label = `${attemptLabel}-attempt${job.attemptsMade + 1}`
      await recreateAdAsActive(adId, token, { creativeId, adsetId, adName, adAccountId }, label)
    },
    {
      connection,
      concurrency: 10,
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`[AdActivation] Job ${job?.id} (ad ${job?.data?.adId}) falhou:`, err.message)
  })

  worker.on('completed', (job) => {
    console.log(`[AdActivation] Job ${job.id} (ad ${job.data.adId}) concluído`)
  })

  console.log('[AdActivation] Worker inicializado')
  return adActivationQueue
}
