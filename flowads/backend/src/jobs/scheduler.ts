import { Queue, Worker } from 'bullmq'
import cron from 'node-cron'
import { supabase } from '../lib/supabase'
import { executeAutomation } from './executor'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const TZ = process.env.SCHEDULER_TIMEZONE || 'America/Sao_Paulo'

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

export let automationQueue: Queue
let schedulerWorker: Worker

// Escalona execuções do mesmo minuto em até 59s — determinístico por automationId
function staggerSeconds(automationId: string): number {
  let hash = 0
  for (let i = 0; i < automationId.length; i++) {
    hash = (hash * 31 + automationId.charCodeAt(i)) >>> 0
  }
  return hash % 60
}

export function initQueue() {
  const connection = parseRedisConnection(redisUrl)

  automationQueue = new Queue('automations', { connection })

  schedulerWorker = new Worker(
    'automations',
    async (job) => {
      const { automationId, payload } = job.data
      console.log(`[Scheduler] Executando automação ${automationId}`)
      await executeAutomation(automationId, payload)
    },
    {
      connection,
      lockDuration: 600_000,  // 10 min — suporta uploads longos
      concurrency: 4,
      limiter: {
        max: 8,
        duration: 10_000,
      },
    }
  )

  schedulerWorker.on('failed', (job, err) => {
    console.error(`[Scheduler] Job ${job?.id} falhou:`, err.message)
  })

  return automationQueue
}

// Retorna a hora atual no fuso do scheduler como objeto Date
function nowInTZ(): Date {
  const str = new Date().toLocaleString('en-US', { timeZone: TZ })
  return new Date(str)
}

// Verifica se o trigger config corresponde ao horário atual
function shouldRunAt(config: Record<string, unknown>, now: Date): boolean {
  const { frequency, time, days, day_of_month } = config as {
    frequency?: string
    time?: string
    days?: string[]
    day_of_month?: number
  }

  const [hour, minute] = (time || '08:00').split(':').map(Number)
  if (now.getHours() !== hour || now.getMinutes() !== minute) return false

  switch (frequency) {
    case 'weekly': {
      const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
      return (days || ['mon']).some(d => dayMap[d] === now.getDay())
    }
    case 'monthly':
      return now.getDate() === (day_of_month || 1)
    case 'daily':
    default:
      return true
  }
}

export async function initCronDispatcher() {
  // Remove jobs repetíveis legados do esquema anterior (BullMQ repeat)
  try {
    const legacy = await automationQueue.getRepeatableJobs()
    for (const job of legacy) await automationQueue.removeRepeatableByKey(job.key)
    if (legacy.length > 0) console.log(`[CronDispatcher] ${legacy.length} jobs repetíveis legados removidos`)
  } catch { /* ignora — Redis pode não ter jobs anteriores */ }

  // A cada minuto: consulta Supabase e despacha as automações que vencem agora
  cron.schedule('* * * * *', async () => {
    const now = nowInTZ()
    const label = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`

    try {
      const { data: automations } = await supabase
        .from('automations')
        .select('id, automation_nodes(*)')
        .eq('is_active', true)

      if (!automations?.length) return

      let dispatched = 0
      for (const auto of automations) {
        const nodes = (auto.automation_nodes || []) as Array<{ type: string; config: Record<string, unknown> }>
        const trigger = nodes.find(n => n.type === 'trigger.schedule')
        if (!trigger || !shouldRunAt(trigger.config, now)) continue

        // jobId único por automação + minuto exato — garante idempotência
        const jobId = `${auto.id}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}:${now.getHours()}:${now.getMinutes()}`

        await automationQueue.add(
          auto.id,
          { automationId: auto.id, payload: null },
          {
            jobId,
            delay: staggerSeconds(auto.id) * 1000, // espalha até 59s dentro do minuto
            removeOnComplete: true,
            removeOnFail: 100,
          }
        )
        dispatched++
      }

      if (dispatched > 0) {
        console.log(`[CronDispatcher] ${label} — ${dispatched} automação(ões) despachada(s)`)
      }
    } catch (err) {
      console.error('[CronDispatcher] Erro ao verificar automações:', err)
    }
  }, { timezone: TZ })

  console.log(`[CronDispatcher] Iniciado — verificando a cada minuto (tz: ${TZ})`)
}
