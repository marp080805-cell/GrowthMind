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
  token: string
  attemptLabel: string
  creativeId: string
  adsetId: string
  adName: string
  adAccountId: string
}

let adActivationQueue: Queue | null = null

export function scheduleAdActivation(
  token: string,
  meta: { creativeId: string; adsetId: string; adName: string; adAccountId: string },
  delayMs = 5 * 60 * 1000,
) {
  if (!adActivationQueue) {
    console.warn(`[AdActivation] Queue não inicializada — usando setTimeout fallback`)
    setTimeout(() => createAdAsActive(token, meta, 'setTimeout-fallback'), delayMs)
    return
  }

  const jobData: AdActivationJobData = {
    token,
    attemptLabel: '5min',
    creativeId: meta.creativeId,
    adsetId: meta.adsetId,
    adName: meta.adName,
    adAccountId: meta.adAccountId,
  }

  adActivationQueue.add('activate', jobData, {
    delay: delayMs,
    attempts: 3,
    backoff: { type: 'fixed', delay: 15 * 60 * 1000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  }).then(() => {
    console.log(`[AdActivation] Job agendado: creative ${meta.creativeId} vira ad ACTIVE em ${delayMs / 60000}min`)
  }).catch((err) => {
    console.error(`[AdActivation] Erro ao agendar job:`, err)
    setTimeout(() => createAdAsActive(token, meta, 'setTimeout-fallback'), delayMs)
  })
}

// Cria o ad diretamente como ACTIVE — sem passar por PAUSED.
// O criativo já existe (criado previamente). Aqui apenas criamos o objeto de anúncio
// usando o path "create-and-publish", que não dispara a validação que causa WITH_ISSUES 1346001.
async function createAdAsActive(
  token: string,
  meta: { creativeId: string; adsetId: string; adName: string; adAccountId: string },
  label: string
) {
  console.log(`[AdActivation] Criando ad como ACTIVE [${label}]...`)

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
  console.log(`[AdActivation] Ad ACTIVE criado: ${newAdId} [${label}]`)
}

export function initAdActivationWorker() {
  const connection = parseRedisConnection(redisUrl)

  adActivationQueue = new Queue('ad-activations', { connection })

  const worker = new Worker<AdActivationJobData>(
    'ad-activations',
    async (job) => {
      const { token, attemptLabel, creativeId, adsetId, adName, adAccountId } = job.data
      const label = `${attemptLabel}-attempt${job.attemptsMade + 1}`
      await createAdAsActive(token, { creativeId, adsetId, adName, adAccountId }, label)
    },
    {
      connection,
      concurrency: 10,
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`[AdActivation] Job ${job?.id} (creative ${job?.data?.creativeId}) falhou:`, err.message)
  })

  worker.on('completed', (job) => {
    console.log(`[AdActivation] Job ${job.id} (creative ${job.data.creativeId}) concluído`)
  })

  console.log('[AdActivation] Worker inicializado')
  return adActivationQueue
}
