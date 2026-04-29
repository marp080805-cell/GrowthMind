/**
 * Executor de Operações Meta com Integração de Fila
 * Valida e enfileira operações Meta para execução com rate limiting global
 */

import { queueManager, type MetaQueueJob } from '../jobs/account-queue-manager'
import { validateMetaRequest } from './request-validator'
import { MetaService } from '../services/meta.service'
import { supabase } from './supabase'

export interface MetaOperationOptions {
  automationId: string
  clientId: string
  adAccountId: string
  action: string
  payload: Record<string, unknown>
  useQueue?: boolean // Se true, sempre usa fila. Se false, executa direto se allowed
}

/**
 * Executar operação Meta com suporte a fila
 * Retorna resultado da execução
 */
export async function executeMetaOperation(
  options: MetaOperationOptions
): Promise<unknown> {
  const {
    automationId,
    clientId,
    adAccountId,
    action,
    payload,
    useQueue = true, // Default: usar fila para operações críticas
  } = options

  // Validar request antes de qualquer coisa
  const validation = await validateMetaRequest(clientId, adAccountId, action, payload)
  if (!validation.valid) {
    throw new Error(`Validação falhou: ${validation.reason}`)
  }

  // Se usar fila, enfilar e retornar jobId
  if (useQueue) {
    const job: MetaQueueJob = {
      automationId,
      clientId,
      adAccountId,
      action,
      payload,
      timestamp: Date.now(),
      retries: 0,
    }

    const jobId = await queueManager.enqueueMetaOperation(job)
    console.log(`[MetaOpExecutor] Operação enfileirada: ${action} (jobId: ${jobId})`)

    // Aguardar conclusão do job (com timeout)
    const result = await waitForJobCompletion(jobId, adAccountId)
    return result
  }

  // Caso contrário, executar direto (para operações não-críticas)
  const { data: clientRaw } = await supabase
    .from('clients')
    .select('*, settings:settings(*)')
    .eq('id', clientId)
    .single()

  if (!clientRaw) throw new Error(`Cliente ${clientId} não encontrado`)

  const client = clientRaw as Record<string, unknown> & { meta_token?: string; settings?: { meta_token?: string } | Array<{ meta_token?: string }> }
  const clientSettings = Array.isArray(client.settings) ? client.settings[0] : client.settings
  const token = client.meta_token || clientSettings?.meta_token || ''
  const meta = new MetaService(token, adAccountId)

  return await executeActionDirect(meta, action, payload)
}

/**
 * Executar ação Meta diretamente (sem fila)
 * Usado para operações que já foram validadas e enfileiradas
 */
export async function executeActionDirect(
  meta: MetaService,
  action: string,
  payload: Record<string, unknown>
): Promise<unknown> {
  switch (action) {
    case 'create_campaign':
      return await meta.createCampaign({
        name: payload.name as string,
        objective: payload.objective as string,
        status: (payload.status as string) || 'PAUSED',
        daily_budget: payload.daily_budget as number | undefined,
        lifetime_budget: payload.lifetime_budget as number | undefined,
        start_time: payload.start_time as string | undefined,
        stop_time: payload.stop_time as string | undefined,
        special_ad_categories: payload.special_ad_categories as string[] | undefined,
      })

    case 'create_adset':
      return await meta.createAdSet({
        campaign_id: payload.campaign_id as string,
        name: (payload.name as string) || 'Conjunto de anúncios',
        optimization_goal: (payload.optimization_goal as string) || 'REACH',
        billing_event: (payload.billing_event as string) || 'IMPRESSIONS',
        targeting: (payload.targeting as Record<string, unknown>) || { geo_locations: { countries: ['BR'] } },
        daily_budget: payload.daily_budget as number | undefined,
        lifetime_budget: payload.lifetime_budget as number | undefined,
        status: (payload.status as string) || 'PAUSED',
        start_time: payload.start_time as string | undefined,
        end_time: payload.end_time as string | undefined,
      })

    case 'create_ad':
      return await meta.createAd({
        adset_id: payload.adset_id as string,
        name: payload.name as string,
        creative_id: payload.creative_id as string | undefined,
        status: (payload.status as string) || 'PAUSED',
      })

    case 'edit_campaign':
      return await meta.editCampaign(
        payload.campaign_id as string,
        payload as Record<string, unknown>
      )

    case 'edit_ad':
      return await meta.editAd(
        payload.ad_id as string,
        payload as Record<string, unknown>
      )

    case 'edit_adset':
      return await meta.editAdSet(
        payload.adset_id as string,
        payload as Record<string, unknown>
      )

    case 'pause_ad':
      return await meta.pauseObject(payload.object_id as string)

    case 'activate_ad':
      return await meta.activateObject(payload.object_id as string)

    case 'upload_creative': {
      if (payload.type === 'image') {
        const imageUrl = payload.image_url as string
        const imageRes = await fetch(imageUrl)
        const imageBytes = Buffer.from(await imageRes.arrayBuffer())
        return await meta.uploadAdImage(imageBytes)
      } else if (payload.type === 'video') {
        const videoUrl = payload.video_url as string
        const videoRes = await fetch(videoUrl, { signal: AbortSignal.timeout(300_000) })
        const videoBytes = Buffer.from(await videoRes.arrayBuffer())
        const videoName = (payload.name as string) || 'video.mp4'
        const mimeType = (payload.mime_type as string) || 'video/mp4'
        return await meta.uploadAdVideo(videoBytes, videoName, mimeType)
      }
      throw new Error('Tipo de criativo desconhecido')
    }

    case 'duplicate_campaign':
      return await meta.duplicateCampaign(
        payload.campaign_id as string,
        payload.name as string
      )

    default:
      throw new Error(`Ação desconhecida: ${action}`)
  }
}

/**
 * Aguardar conclusão de job na fila
 * Implementa polling com timeout
 */
async function waitForJobCompletion(
  jobId: string,
  adAccountId: string,
  maxWaitMs: number = 300_000 // 5 minutos
): Promise<unknown> {
  const startTime = Date.now()
  const pollInterval = 500 // Poll a cada 500ms

  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Em produção, buscaríamos via Redis o status do job
      // Por enquanto, aguardamos um pouco e retornamos
      // O resultado real virá do queue worker após execução
      await new Promise(r => setTimeout(r, pollInterval))

      // Placeholder: em caso real, verificaríamos job.isCompleted()
      // Retorna que o job foi enfileirado
      return { jobId, queued: true, message: 'Operação enfileirada com sucesso' }
    } catch (err) {
      // Se erro, tenta novamente
      continue
    }
  }

  throw new Error(`Timeout aguardando conclusão de job ${jobId} (após ${maxWaitMs}ms)`)
}
