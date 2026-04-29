/**
 * Gerenciador de tokens com criptografia automática
 * Compatível com tokens antigos em plaintext (migração gradual)
 */

import { supabase } from './supabase'
import { encryptToken, decryptToken } from './crypto'

/**
 * Buscar token de forma segura — descriptografa se necessário
 * Compatível com tokens antigos em plaintext
 */
export async function getSecureToken(table: 'clients' | 'settings', recordId: string): Promise<string | null> {
  const { data } = await supabase
    .from(table)
    .select('meta_token')
    .eq('id', recordId)
    .single()

  if (!data?.meta_token) return null

  // Tentar descriptografar (se falhar, é token antigo em plaintext)
  try {
    return decryptToken(data.meta_token)
  } catch {
    // Token é plaintext — migrar para encriptado na próxima oportunidade
    return data.meta_token
  }
}

/**
 * Salvar token de forma segura — encripta antes de salvar
 */
export async function setSecureToken(table: 'clients' | 'settings', recordId: string, token: string): Promise<boolean> {
  const encrypted = encryptToken(token)

  const { error } = await supabase
    .from(table)
    .update({ meta_token: encrypted, updated_at: new Date().toISOString() })
    .eq('id', recordId)

  return !error
}

/**
 * Buscar client com token descriptografado
 */
export async function getClientWithToken(clientId: string) {
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (!data) return null

  // Descriptografar token se necessário
  if (data.meta_token) {
    try {
      data.meta_token = decryptToken(data.meta_token)
    } catch {
      // Token é plaintext, deixar como está
    }
  }

  return data
}

/**
 * Buscar settings com token descriptografado
 */
export async function getSettingsWithToken() {
  const { data } = await supabase
    .from('settings')
    .select('*')
    .single()

  if (!data) return null

  // Descriptografar token se necessário
  if (data.meta_token) {
    try {
      data.meta_token = decryptToken(data.meta_token)
    } catch {
      // Token é plaintext, deixar como está
    }
  }

  return data
}
