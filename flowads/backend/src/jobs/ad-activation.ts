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
  adId: string
  token: string
  attemptLabel: string
}

let adActivationQueue: Queue | null = null

export function scheduleAdActivation(adId: string, token: string, delayMs = 5 * 60 * 1000) {
  if (!adActivationQueue) {
    console.warn(`[AdActivation] Queue não inicializada — usando setTimeout fallback para ad ${adId}`)
    setTimeout(() => activateAd(adId, token, 'setTimeout-fallback'), delayMs)
    return
  }

  adActivationQueue.add(
    'activate',
    { adId, token, attemptLabel: '5min' } satisfies AdActivationJobData,
    {
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'fixed', delay: 15 * 60 * 1000 }, // retry a cada 15min se falhar
      removeOnComplete: 100,
      removeOnFail: 200,
    }
  ).then(() => {
    console.log(`[AdActivation] Job agendado: ad ${adId} ativado em ${delayMs / 60000}min`)
  }).catch((err) => {
    console.error(`[AdActivation] Erro ao agendar job para ad ${adId}:`, err)
    // Fallback para setTimeout se o BullMQ falhar
    setTimeout(() => activateAd(adId, token, 'setTimeout-fallback'), delayMs)
  })
}

async function activateAd(adId: string, token: string, label: string) {
  console.log(`[AdActivation] Tentando ativar ad ${adId} [${label}]...`)
  const res = await fetch(`${META_API}/${adId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ACTIVE', access_token: token }),
  })

  const data = await res.json() as Record<string, unknown>

  if (!res.ok) {
    const errMsg = JSON.stringify(data)
    console.error(`[AdActivation] Falha ao ativar ad ${adId} [${label}]:`, errMsg)
    throw new Error(errMsg)
  }

  console.log(`[AdActivation] Ad ${adId} [${label}] ativado com sucesso`)

  // Checar status 30s após ativação — se WITH_ISSUES, reativar (equivale ao clique manual)
  setTimeout(() => checkAndReactivate(adId, token, label, 1), 30_000)
}

async function checkAndReactivate(adId: string, token: string, label: string, attempt: number) {
  try {
    const statusRes = await fetch(
      `${META_API}/${adId}?fields=effective_status,issues_info&access_token=${token}`
    )
    const status = await statusRes.json() as {
      effective_status?: string
      issues_info?: Array<{ error_code: number; error_message: string }>
    }
    console.log(`[AdActivation] Ad ${adId} [${label}] check#${attempt}: effective=${status.effective_status}`)

    if (status.effective_status === 'WITH_ISSUES' && attempt <= 2) {
      // WITH_ISSUES: reativar após 60s — mesmo efeito do clique manual no Ads Manager
      console.log(`[AdActivation] Ad ${adId} WITH_ISSUES → reativando em 60s (tentativa ${attempt})`)
      setTimeout(async () => {
        try {
          await fetch(`${META_API}/${adId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ACTIVE', access_token: token }),
          })
          console.log(`[AdActivation] Ad ${adId} reativado (tentativa ${attempt})`)
          setTimeout(() => checkAndReactivate(adId, token, label, attempt + 1), 30_000)
        } catch (e) {
          console.error(`[AdActivation] Ad ${adId} falha na reativação ${attempt}:`, e)
        }
      }, 60_000)
    } else if (status.issues_info?.length) {
      console.warn(`[AdActivation] Ad ${adId} issues persistentes após ${attempt} tentativa(s):`, JSON.stringify(status.issues_info))
    } else {
      console.log(`[AdActivation] Ad ${adId} OK — effective=${status.effective_status}`)
    }
  } catch { /* diagnóstico não bloqueia */ }
}

export function initAdActivationWorker() {
  const connection = parseRedisConnection(redisUrl)

  adActivationQueue = new Queue('ad-activations', { connection })

  const worker = new Worker<AdActivationJobData>(
    'ad-activations',
    async (job) => {
      const { adId, token, attemptLabel } = job.data
      await activateAd(adId, token, `${attemptLabel}-attempt${job.attemptsMade + 1}`)
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
