/**
 * Wrapper seguro para Supabase que encripta/descriptografa tokens automaticamente
 */

import { createClient } from '@supabase/supabase-js'
import { encryptToken, decryptToken, isSensitiveField } from './crypto'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Wrapper para .insert() que encripta campos sensíveis automaticamente
 */
export function withEncryption<T extends Record<string, unknown>>(data: T): T {
  const encrypted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && isSensitiveField(key)) {
      encrypted[key] = encryptToken(value)
    } else {
      encrypted[key] = value
    }
  }
  return encrypted as T
}

/**
 * Wrapper para .select() que descriptografa campos sensíveis automaticamente
 * Use após: const { data } = await supabase.from('clients').select('*')
 */
export function withDecryption<T extends Record<string, unknown>>(data: T | T[] | null): T | T[] | null {
  if (!data) return data

  const processRow = (row: T): T => {
    const decrypted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string' && isSensitiveField(key)) {
        try {
          decrypted[key] = decryptToken(value)
        } catch {
          // Se descriptografia falhar, retornar vazio (token corrompido)
          decrypted[key] = '[DECRYPTION_FAILED]'
        }
      } else {
        decrypted[key] = value
      }
    }
    return decrypted as T
  }

  if (Array.isArray(data)) {
    return data.map(processRow)
  }
  return processRow(data)
}

/**
 * Wrapper para .update() que encripta antes de atualizar
 */
export function withUpdateEncryption<T extends Record<string, unknown>>(data: T): T {
  return withEncryption(data)
}

// Re-exportar supabase para uso normal em outros arquivos
export { supabase as default }
