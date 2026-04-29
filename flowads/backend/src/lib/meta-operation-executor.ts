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
  const { data: client } = await supabase
    .from('clients')
    .select('*, settings:settings(*)')
    .eq('id', clientId)
    .single()

  if (!client) throw new Error(`Cliente ${clientId} não encontrado`)

  const token = client.meta_token || client.settings?.meta_token
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
      return await meta.createCampaign(
        payload.name as string,
        payload.objective as string,
        payload.daily_budget as number | undefined
      )

    case 'create_adset':
      return await meta.createAdSet(
        payload.campaign_id as string,
        payload.targeting as Record<string, unknown>,
        payload.daily_budget as number | undefined
      )

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

    case 'upload_creative':
      if (payload.type === 'image') {
        return await meta.uploadAdImage(
          payload.image_url as string,
          payload.page_id as string
        )
      } else if (payload.type === 'video') {
        return await meta.uploadAdVideo(
          payload.video_url as string,
          payload.page_id as string
        )
      }
      throw new Error('Tipo de criativo desconhecido')

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
