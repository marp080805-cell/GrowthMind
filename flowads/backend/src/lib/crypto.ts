import crypto from 'crypto'

/**
 * Criptografia de tokens sensíveis (Meta, OpenAI, etc.)
 * Usa AES-256-GCM com master key do environment
 */

const MASTER_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'default-unsafe-key-change-in-prod'

function getMasterKey(): Buffer {
  // Usar key de 32 bytes (256 bits) para AES-256
  if (MASTER_KEY.length < 32) {
    // Se key é menor, hash para expandir
    return crypto.createHash('sha256').update(MASTER_KEY).digest()
  }
  return Buffer.from(MASTER_KEY.slice(0, 32))
}

export function encryptToken(token: string): string {
  /**
   * Encripta token e retorna formato: iv:authTag:encryptedData
   * Cada encriptação tem IV único (determinístico impossível)
   */
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv)

  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Formato: iv:authTag:encrypted (todos em hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decryptToken(encryptedData: string): string {
  /**
   * Descriptografa token do formato iv:authTag:encrypted
   */
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Formato de token inválido')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export function isSensitiveField(fieldName: string): boolean {
  /**
   * Determina se um campo deve ser criptografado
   */
  const sensitiveFields = ['meta_token', 'openai_api_key', 'anthropic_api_key', 'whatsapp_token']
  return sensitiveFields.includes(fieldName.toLowerCase())
}
