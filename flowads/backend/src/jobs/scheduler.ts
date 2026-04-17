import { Queue, Worker } from 'bullmq'
import { supabase } from '../lib/supabase'
import { executeAutomation } from './executor'

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

export let automationQueue: Queue
let schedulerWorker: Worker

// Espalha execuções agendadas no mesmo horário em até 9 minutos
// Determinístico por automationId — sempre o mesmo offset entre restarts
function staggerMinutes(automationId: string): number {
  let hash = 0
  for (let i = 0; i < automationId.length; i++) {
    hash = (hash * 31 + automationId.charCodeAt(i)) >>> 0
  }
  return hash % 10 // 0 a 9 minutos
}

export function initQueue() {
  const connection = parseRedisConnection(redisUrl)

  automationQueue = new Queue('automations', { connection })

  schedulerWorker = new Worker(
    'automations',
    async (job) => {
      const { automationId, payload } = job.data
      console.log(`[Scheduler] Executing automation ${automationId}`)
      await executeAutomation(automationId, payload)
    },
    {
      connection,
      lockDuration: 600_000,  // 10 min — suporta uploads longos
      concurrency: 4,         // 4 automações simultâneas (~1/3 da VPS KVM2)
      limiter: {
        max: 8,               // máx 8 jobs iniciados por janela
        duration: 10_000,     // janela de 10 segundos
      },
    }
  )

  schedulerWorker.on('failed', (job, err) => {
    console.error(`[Scheduler] Job ${job?.id} failed:`, err.message)
  })

  return automationQueue
}

export async function loadScheduledAutomations() {
  const { data: automations } = await supabase
    .from('automations')
    .select('*, automation_nodes(*)')
    .eq('is_active', true)

  if (!automations) return

  for (const auto of automations) {
    const nodes = (auto.automation_nodes || []) as Array<{ type: string; config: Record<string, unknown> }>
    const triggerNode = nodes.find((n) => n.type === 'trigger.schedule')
    if (!triggerNode) continue

    await scheduleAutomation(auto.id, triggerNode.config)
  }

  console.log(`[Scheduler] Loaded ${automations.length} scheduled automations`)
}

export async function scheduleAutomation(
  automationId: string,
  triggerConfig: Record<string, unknown>
) {
  if (!automationQueue) {
    console.warn(`[Scheduler] Queue not initialized, skipping schedule for ${automationId}`)
    return
  }
  // Remove ALL existing repeatable jobs for this automation (by name match)
  const repeatableJobs = await automationQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    if (job.name === automationId) {
      await automationQueue.removeRepeatableByKey(job.key)
    }
  }

  const cron = buildCron(triggerConfig, staggerMinutes(automationId))
  if (!cron) return

  const tz = process.env.SCHEDULER_TIMEZONE || 'America/Sao_Paulo'
  await automationQueue.add(
    automationId,
    { automationId, payload: null },
    {
      repeat: { pattern: cron, tz },
      removeOnComplete: true,
      removeOnFail: 100,
    }
  )
  console.log(`[Scheduler] Scheduled automation ${automationId} with cron: ${cron} (tz: ${tz})`)
}

export async function unscheduleAutomation(automationId: string) {
  if (!automationQueue) return
  try {
    const repeatableJobs = await automationQueue.getRepeatableJobs()
    for (const job of repeatableJobs) {
      if (job.name === automationId) {
        await automationQueue.removeRepeatableByKey(job.key)
      }
    }
    console.log(`[Scheduler] Unscheduled automation ${automationId}`)
  } catch (err) {
    console.warn(`[Scheduler] Could not unschedule ${automationId}:`, err)
  }
}

function buildCron(config: Record<string, unknown>, stagger = 0): string | null {
  const { frequency, time, days, day_of_month, cron } = config as Record<string, unknown>

  if (cron) return cron as string

  const [hour, minute] = ((time as string) || '08:00').split(':').map(Number)
  const totalMinutes = minute + stagger
  const m = totalMinutes % 60
  const h = (hour + Math.floor(totalMinutes / 60)) % 24

  switch (frequency) {
    case 'daily':
      return `${m} ${h} * * *`
    case 'weekly': {
      const dayNums = ((days as string[]) || ['mon']).map((d) => {
        const map: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 }
        return map[d] ?? 1
      })
      return `${m} ${h} * * ${dayNums.join(',')}`
    }
    case 'monthly':
      return `${m} ${h} ${day_of_month || 1} * *`
    default:
      return `${m} ${h} * * *`
  }
}
