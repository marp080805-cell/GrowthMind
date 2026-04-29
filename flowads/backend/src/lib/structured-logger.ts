/**
 * Logger estruturado que redacta tokens e dados sensíveis automaticamente
 * Previne vazamento de credenciais em logs
 */

const SENSITIVE_FIELDS = new Set([
  'token', 'access_token', 'meta_token', 'api_key', 'secret',
  'password', 'authorization', 'bearer', 'credential',
  'openai_api_key', 'anthropic_api_key', 'whatsapp_token',
])

const REDACT_VALUE = '[REDACTED]'

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  context: string  // Função/módulo que gerou o log
  message: string
  data?: Record<string, unknown>
  error?: {
    message: string
    stack?: string
  }
}

function isSensitiveField(key: string): boolean {
  /**
   * Determina se um campo deve ser redatado
   */
  const lowerKey = key.toLowerCase()
  for (const sensitive of SENSITIVE_FIELDS) {
    if (lowerKey.includes(sensitive)) return true
  }
  return false
}

function redactValue(value: unknown): unknown {
  /**
   * Redacta valores sensíveis recursivamente
   */
  if (value === null || value === undefined) return value

  if (typeof value === 'string') {
    // Detectar padrões de token (JWT, Bearer, etc)
    if (value.length > 20 && (value.includes('.') || value.startsWith('sk-'))) {
      return REDACT_VALUE
    }
    return value
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(redactValue)
    }
    const redacted: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (isSensitiveField(k)) {
        redacted[k] = REDACT_VALUE
      } else {
        redacted[k] = redactValue(v)
      }
    }
    return redacted
  }

  return value
}

export function redactData(data: Record<string, unknown>): Record<string, unknown> {
  /**
   * Redacta todos os campos sensíveis em um objeto
   */
  const redacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveField(key)) {
      redacted[key] = REDACT_VALUE
    } else {
      redacted[key] = redactValue(value)
    }
  }
  return redacted
}

export function createLogger(context: string) {
  /**
   * Factory function para criar logger com contexto fixo
   * Exemplo: const logger = createLogger('executor.ts')
   */

  return {
    info(message: string, data?: Record<string, unknown>) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        context,
        message,
        data: data ? redactData(data) : undefined,
      }
      console.log(`[${context}]`, message, data ? redactData(data) : '')
    },

    warn(message: string, data?: Record<string, unknown>) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'warn',
        context,
        message,
        data: data ? redactData(data) : undefined,
      }
      console.warn(`[${context}]`, message, data ? redactData(data) : '')
    },

    error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        context,
        message,
        error: error instanceof Error
          ? {
              message: error.message,
              stack: error.stack?.split('\n').slice(0, 5).join('\n'),
            }
          : undefined,
        data: data ? redactData(data) : undefined,
      }
      console.error(
        `[${context}]`,
        message,
        error instanceof Error ? error.message : error,
        data ? redactData(data) : ''
      )
    },

    debug(message: string, data?: Record<string, unknown>) {
      if (process.env.DEBUG) {
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'debug',
          context,
          message,
          data: data ? redactData(data) : undefined,
        }
        console.debug(`[${context}]`, message, data ? redactData(data) : '')
      }
    },
  }
}

// Exemplo de uso:
// const logger = createLogger('meta.service.ts')
// logger.info('Criando anúncio', { adsetId, name })  // Token será redatado se existir
