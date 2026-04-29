/**
 * Gerenciador de Fila Global por Ad Account
 * Garante que apenas 1 requisição Meta por account por vez
 * Implementa rate limiting global e health checking
 */

import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'

export interface MetaQueueJob {
  automationId: string
  clientId: string
  adAccountId: string
  action: string // 'create_ad', 'edit_campaign', etc
  payload: Record<string, unknown>
  timestamp: number
  retries: number
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

export class AccountQueueManager {
  private redis: Redis
  private queues: Map<string, Queue> = new Map()
  private workers: Map<string, Worker> = new Map()

  constructor() {
    this.redis = new Redis(redisUrl)
  }

  /**
   * Enfileira um job para execução
   * Retorna jobId para tracking
   */
  async enqueueMetaOperation(job: MetaQueueJob): Promise<string> {
    const queueName = `meta:account:${job.adAccountId}`
    const queue = this.getOrCreateQueue(queueName)

    // Validar antes de enfilar
    const validation = await this.validateBeforeQueue(job)
    if (!validation.allowed) {
      throw new Error(`Operação bloqueada: ${validation.reason}`)
    }

    // Enfileirar com prioridade e delay
    const bullJob = await queue.add(
      `${job.action}:${job.clientId}`,
      job,
      {
        jobId: `${job.automationId}:${Date.now()}`,
        delay: 0, // Worker controla delay
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, 4s, 8s
        },
        removeOnComplete: true,
        removeOnFail: false, // Manter fails para análise
      }
    )

    return bullJob.id!
  }

  /**
   * Criar ou obter queue para account específico
   */
  private getOrCreateQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, { connection: this.redis })
      this.queues.set(queueName, queue)

      // Limpar jobs antigos (> 24h)
      this.cleanupOldJobs(queue)
    }
    return this.queues.get(queueName)!
  }

  /**
   * Validar se operação pode ser enfileirada
   * Checa: rate limit global, health da conta, etc
   */
  private async validateBeforeQueue(job: MetaQueueJob): Promise<{ allowed: boolean; reason?: string }> {
    const { adAccountId, action } = job

    // 1. Health check da conta
    const accountKey = `health:${adAccountId}`
    const health = await this.redis.get(accountKey)
    if (health === 'restricted') {
      return { allowed: false, reason: 'Ad account está restringida pela Meta' }
    }

    // 2. Verificar fila não está muito grande (> 1000 jobs = problema)
    const queueName = `meta:account:${adAccountId}`
    const queue = this.getOrCreateQueue(queueName)
    const queueSize = await queue.count()
    if (queueSize > 1000) {
      return { allowed: false, reason: `Fila muito grande (${queueSize} jobs)` }
    }

    // 3. Rate limit global
    const rateLimitKey = `ratelimit:${adAccountId}:${getHour()}`
    const requestCount = await this.redis.get(rateLimitKey)
    const count = parseInt(requestCount || '0')

    const limits: Record<string, number> = {
      create_campaign: 5,
      create_adset: 10,
      create_ad: 8,
      edit_campaign: 20,
      edit_adset: 20,
      edit_ad: 20,
      pause_ad: 20,
      activate_ad: 20,
      upload_creative: 5,
      create_audience: 3,
    }

    const limit = limits[action] || 20
    if (count >= limit) {
      return {
        allowed: false,
        reason: `Limite de ${action} atingido esta hora (${limit})`
      }
    }

    return { allowed: true }
  }

  /**
   * Incrementar rate limit
   * Chamado após execução bem-sucedida
   */
  async recordExecution(adAccountId: string, action: string): Promise<void> {
    const key = `ratelimit:${adAccountId}:${getHour()}`
    await this.redis.incr(key)
    await this.redis.expire(key, 3600) // TTL 1 hora
  }

  /**
   * Registrar status de saúde da conta
   */
  async setAccountHealth(adAccountId: string, status: 'healthy' | 'restricted' | 'warning'): Promise<void> {
    const key = `health:${adAccountId}`
    if (status === 'healthy') {
      await this.redis.del(key)
    } else {
      await this.redis.set(key, status, 'EX', 3600) // 1 hora
    }
  }

  /**
   * Obter status de saúde da conta
   */
  async getAccountHealth(adAccountId: string): Promise<string> {
    const health = await this.redis.get(`health:${adAccountId}`)
    return health || 'healthy'
  }

  /**
   * Limpar jobs antigos da queue
   */
  private async cleanupOldJobs(queue: Queue): Promise<void> {
    const oneHourAgo = Date.now() - 3600000
    const jobs = await queue.getJobs(['failed', 'completed'], 0, -1)

    for (const job of jobs) {
      if ((job.finishedOn || job.processedOn || 0) < oneHourAgo) {
        await job.remove()
      }
    }
  }

  /**
   * Obter status de fila para monitoring
   */
  async getQueueStatus(adAccountId: string): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
  }> {
    const queueName = `meta:account:${adAccountId}`
    const queue = this.getOrCreateQueue(queueName)

    return {
      waiting: await queue.getWaitingCount(),
      active: await queue.getActiveCount(),
      completed: await queue.getCompletedCount(),
      failed: await queue.getFailedCount(),
    }
  }

  /**
   * Shutdown gracioso
   */
  async shutdown(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close()
    }
    for (const queue of this.queues.values()) {
      await queue.close()
    }
    await this.redis.quit()
  }
}

/**
 * Helper: obter hora atual em formato HH
 */
function getHour(): string {
  const now = new Date()
  return String(now.getHours()).padStart(2, '0')
}

// Singleton instance
export const queueManager = new AccountQueueManager()
