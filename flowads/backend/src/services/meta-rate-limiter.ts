/**
 * Rate limiter proativo para a API de Marketing da Meta.
 *
 * Estratégia baseada na documentação oficial:
 * https://developers.facebook.com/docs/graph-api/overview/rate-limiting
 * https://developers.facebook.com/docs/marketing-api/overview/rate-limiting
 *
 * A Meta usa Business Use Case (BUC) quotas, expostas via header
 * X-Business-Use-Case-Usage. O rate limiter ajusta a taxa de chamadas
 * dinamicamente conforme o percentual de uso reportado.
 *
 * Rate limiting é por conta de anúncios (adAccountId), não por cliente —
 * múltiplos clientes podem compartilhar a mesma conta de anúncios.
 */

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Taxa de chamadas por segundo conforme uso do BUC
// Conservador para manter margem segura antes do limite
const THROTTLE_LEVELS = [
  { minUsage: 80, ratePerSec: 0.2 },  // >80%: 1 chamada a cada 5s — zone de perigo
  { minUsage: 50, ratePerSec: 0.5 },  // >50%: 1 chamada a cada 2s
  { minUsage: 30, ratePerSec: 1.0 },  // >30%: 1 chamada por segundo
  { minUsage: 0,  ratePerSec: 2.0 },  // normal: 2 chamadas por segundo
]

class TokenBucket {
  private tokens: number
  private lastRefill: number
  private refillPerSec: number
  private readonly maxTokens = 5 // capacidade de burst

  constructor() {
    this.tokens = this.maxTokens
    this.lastRefill = Date.now()
    this.refillPerSec = 2.0
  }

  adjustRate(bucUsagePct: number): void {
    for (const level of THROTTLE_LEVELS) {
      if (bucUsagePct >= level.minUsage) {
        this.refillPerSec = level.ratePerSec
        break
      }
    }
  }

  async acquire(): Promise<void> {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }
    // Calcula tempo de espera para o próximo token
    const waitMs = Math.ceil((1 / this.refillPerSec) * 1000)
    await sleep(waitMs)
    this.refill()
    this.tokens = Math.max(0, this.tokens - 1)
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillPerSec)
    this.lastRefill = now
  }
}

class MetaRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>()

  private bucket(adAccountId: string): TokenBucket {
    let b = this.buckets.get(adAccountId)
    if (!b) {
      b = new TokenBucket()
      this.buckets.set(adAccountId, b)
    }
    return b
  }

  async acquire(adAccountId: string): Promise<void> {
    await this.bucket(adAccountId).acquire()
  }

  /**
   * Lê o header X-Business-Use-Case-Usage da resposta da Meta e ajusta a
   * taxa de chamadas para a conta correspondente.
   *
   * Formato do header:
   * {"act_123": [{"call_count": 45, "type": "ads_management", "total_cputime": 30, ...}]}
   */
  updateFromResponse(adAccountId: string, res: Response): void {
    const bucHeader = res.headers.get('X-Business-Use-Case-Usage')
    if (!bucHeader) return
    try {
      const parsed = JSON.parse(bucHeader) as Record<string, Array<{
        call_count: number
        type: string
        estimated_time_to_regain_access?: number
      }>>
      let maxUsage = 0
      for (const entries of Object.values(parsed)) {
        for (const entry of entries) {
          if (entry.call_count > maxUsage) maxUsage = entry.call_count
          if (entry.call_count > 80) {
            console.warn(`[Meta RateLimiter] conta ${adAccountId} — ${entry.type}: ${entry.call_count}% de quota usada. Throttling ativado.`)
          }
        }
      }
      this.bucket(adAccountId).adjustRate(maxUsage)
    } catch { /* ignora header malformado */ }
  }
}

export const metaRateLimiter = new MetaRateLimiter()
