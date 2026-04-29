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

// Escalona execuções do mesmo minuto com stagger aleatório para evitar padrão detectável
function staggerSeconds(automationId: string): number {
  // Determinístico: hash do automationId para distribuição consistente
  let hash = 0
  for (let i = 0; i < automationId.length; i++) {
    hash = (hash * 31 + automationId.charCodeAt(i)) >>> 0
  }
  const baseDelay = hash % 30  // 0-30s base
  // Aleatório: adicionar 30-90s para variar timing e evitar padrão
  const randomDelay = 30 + Math.random() * 60  // 30-90s
  return Math.round(baseDelay + randomDelay) * 1000  // Converter para ms
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

// Extrai hora/minuto/dia atuais no fuso configurado via Intl (confiável em qualquer SO)
function getNowInTZ() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    day: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date())

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return {
    hour: parseInt(get('hour')),
    minute: parseInt(get('minute')),
    dayOfWeek: weekdays.indexOf(get('weekday')),
    dayOfMonth: parseInt(get('day')),
  }
}

// Verifica se o trigger config corresponde ao horário atual
function shouldRunAt(config: Record<string, unknown>, now: ReturnType<typeof getNowInTZ>): boolean {
  const { frequency, time, days, day_of_month } = config as {
    frequency?: string
    time?: string
    days?: string[]
    day_of_month?: number
  }

  const [hour, minute] = (time || '08:00').split(':').map(Number)
  if (now.hour !== hour || now.minute !== minute) return false

  switch (frequency) {
    case 'weekly': {
      const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
      return (days || ['mon']).some(d => dayMap[d] === now.dayOfWeek)
    }
    case 'monthly':
      return now.dayOfMonth === (day_of_month || 1)
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
    const now = getNowInTZ()
    const label = `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')} (${TZ})`

    console.log(`[CronDispatcher] tick ${label}`)

    try {
      const { data: automations, error } = await supabase
        .from('automations')
        .select('id, automation_nodes(*)')
        .eq('is_active', true)

      if (error) { console.error('[CronDispatcher] Erro Supabase:', error.message); return }
      if (!automations?.length) { console.log('[CronDispatcher] Nenhuma automação ativa'); return }

      console.log(`[CronDispatcher] ${automations.length} automação(ões) ativa(s) verificada(s)`)

      let dispatched = 0
      for (const auto of automations) {
        const nodes = (auto.automation_nodes || []) as Array<{ type: string; config: Record<string, unknown> }>
        const trigger = nodes.find(n => n.type === 'trigger.schedule')
        if (!trigger) continue

        const config = trigger.config as { time?: string; frequency?: string }
        const matches = shouldRunAt(trigger.config, now)
        console.log(`[CronDispatcher] automação ${auto.id} — trigger ${config.time} — match: ${matches}`)
        if (!matches) continue

        // jobId único por automação + minuto exato — garante idempotência
        const jobId = `${auto.id}_${now.hour}_${now.minute}_${now.dayOfMonth}_${new Date().getMonth()}`

        await automationQueue.add(
          auto.id,
          { automationId: auto.id, payload: null },
          {
            jobId,
            delay: staggerSeconds(auto.id) * 1000,
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
