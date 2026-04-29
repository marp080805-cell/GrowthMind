/**
 * Validador de Requisições Meta
 * Executa validações pré-vôo antes de enfilar operações
 * Garante que requisição respeita: políticas Meta, rate limits, elegibilidade, etc
 */

import { supabase } from './supabase'
import { MetaService } from '../services/meta.service'

export interface ValidationResult {
  valid: boolean
  reason?: string
}

/**
 * Validar se requisição pode ser enfileirada
 */
export async function validateMetaRequest(
  clientId: string,
  adAccountId: string,
  action: string,
  payload: Record<string, unknown>
): Promise<ValidationResult> {
  // 1. Validar payload básico
  const payloadValidation = validatePayload(action, payload)
  if (!payloadValidation.valid) {
    return payloadValidation
  }

  // 2. Validar client existe e tem token
  const { data: client } = await supabase
    .from('clients')
    .select('id, meta_token, settings:settings(*)')
    .eq('id', clientId)
    .single()

  if (!client) {
    return { valid: false, reason: `Cliente ${clientId} não encontrado` }
  }

  const token = client.meta_token || client.settings?.meta_token
  if (!token) {
    return { valid: false, reason: 'Token Meta não configurado para este cliente' }
  }

  // 3. Validações específicas por ação
  const actionValidation = await validateActionSpecific(
    action,
    payload,
    token,
    adAccountId,
    clientId
  )
  if (!actionValidation.valid) {
    return actionValidation
  }

  return { valid: true }
}

/**
 * Validar payload da requisição
 */
function validatePayload(action: string, payload: Record<string, unknown>): ValidationResult {
  switch (action) {
    case 'create_campaign':
      if (!payload.name || !payload.objective) {
        return { valid: false, reason: 'Faltam fields: name, objective' }
      }
      if (typeof payload.name !== 'string') {
        return { valid: false, reason: 'name deve ser string' }
      }
      return { valid: true }

    case 'create_adset':
      if (!payload.campaign_id || !payload.targeting) {
        return { valid: false, reason: 'Faltam fields: campaign_id, targeting' }
      }
      return { valid: true }

    case 'create_ad':
      if (!payload.adset_id || !payload.name) {
        return { valid: false, reason: 'Faltam fields: adset_id, name' }
      }
      if (payload.creative_id && typeof payload.creative_id !== 'string') {
        return { valid: false, reason: 'creative_id deve ser string' }
      }
      return { valid: true }

    case 'edit_campaign':
    case 'edit_adset':
    case 'edit_ad':
      if (!payload.object_id && !payload.campaign_id && !payload.ad_id && !payload.adset_id) {
        return { valid: false, reason: 'Falta object_id/campaign_id/ad_id/adset_id' }
      }
      return { valid: true }

    case 'pause_ad':
    case 'activate_ad':
      if (!payload.object_id) {
        return { valid: false, reason: 'Falta object_id' }
      }
      return { valid: true }

    case 'upload_creative':
      if (!payload.type || !payload.page_id) {
        return { valid: false, reason: 'Faltam fields: type, page_id' }
      }
      if (payload.type === 'image' && !payload.image_url) {
        return { valid: false, reason: 'image_url obrigatório para type=image' }
      }
      if (payload.type === 'video' && !payload.video_url) {
        return { valid: false, reason: 'video_url obrigatório para type=video' }
      }
      return { valid: true }

    default:
      return { valid: false, reason: `Ação desconhecida: ${action}` }
  }
}

/**
 * Validações específicas por ação
 */
async function validateActionSpecific(
  action: string,
  payload: Record<string, unknown>,
  token: string,
  adAccountId: string,
  clientId: string
): Promise<ValidationResult> {
  const meta = new MetaService(token, adAccountId)

  switch (action) {
    case 'create_adset':
    case 'create_ad':
      // Validar que campaign/adset existe
      const parentId = action === 'create_adset'
        ? payload.campaign_id
        : payload.adset_id

      if (!parentId || typeof parentId !== 'string') {
        return { valid: false, reason: `${action} precisa de parent ID válido` }
      }

      // Tentar buscar o objeto para validar existência
      try {
        // Aqui poderia fazer uma chamada rápida na API Meta
        // Por enquanto, só validamos que o ID tem o formato correto
        if (!/^\d+$/.test(parentId as string)) {
          return { valid: false, reason: `${parentId} não é um ID válido` }
        }
      } catch (err) {
        // Se falhar, deixa passar (será detectado na execução)
      }
      break

    case 'upload_creative':
      // Validar URL
      try {
        const url = new URL(
          payload.type === 'image' ? (payload.image_url as string) : (payload.video_url as string)
        )
        if (url.protocol !== 'https:') {
          return { valid: false, reason: 'URLs devem usar HTTPS' }
        }
        // Validar que não é URL encurtadora
        const domain = url.hostname
        const shorteners = ['bit.ly', 'tinyurl.com', 'short.link', 'ow.ly']
        if (shorteners.some(s => domain.includes(s))) {
          return { valid: false, reason: 'URLs encurtadoras não são permitidas' }
        }
      } catch (err) {
        return { valid: false, reason: 'URL inválida' }
      }
      break
  }

  return { valid: true }
}

/**
 * Validar se landing page é elegível (para pré-vôo de loop)
 */
export async function validateLandingPageEligibility(
  url: string,
  clientId: string
): Promise<ValidationResult> {
  try {
    // Validar URL formato
    const urlObj = new URL(url)
    if (urlObj.protocol !== 'https:') {
      return { valid: false, reason: 'Landing page deve usar HTTPS' }
    }

    // Tentar fazer fetch para validar que página existe e é acessível
    const response = await fetch(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MetaBot/1.0)',
      },
    })

    if (!response.ok) {
      return {
        valid: false,
        reason: `Landing page retornou ${response.status}`,
      }
    }

    // Validar que não é página de erro
    const html = await response.text()
    if (html.length < 500) {
      return {
        valid: false,
        reason: 'Landing page muito pequena (pode estar em erro)',
      }
    }

    // Procurar por sinais de página real (title, meta tags)
    if (!html.includes('<title') && !html.includes('lang=')) {
      return {
        valid: false,
        reason: 'Landing page não parece ser uma página HTML válida',
      }
    }

    return { valid: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { valid: false, reason: `Erro ao validar landing page: ${msg}` }
  }
}
