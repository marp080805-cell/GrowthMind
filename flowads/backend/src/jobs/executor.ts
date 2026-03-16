import { supabase } from '../lib/supabase'
import type {
  AutomationNode, AutomationEdge, ExecutionContext,
  NodeLog, ExecutionLog, Client, Campaign, Settings
} from '../lib/types'
import { MetaService } from '../services/meta.service'
import { OpenAIService } from '../services/openai.service'
import { AnthropicService } from '../services/anthropic.service'
import { WhatsAppService } from '../services/whatsapp.service'

function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const keys = key.trim().split('.')
    let val: unknown = vars
    for (const k of keys) {
      const arrayMatch = k.match(/^\[(\d+)\]$/)
      if (arrayMatch) {
        val = (val as unknown[])?.[parseInt(arrayMatch[1])]
      } else {
        val = (val as Record<string, unknown>)?.[k]
      }
    }
    if (val === undefined || val === null) return ''
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  })
}

function interpolateConfig(config: Record<string, unknown>, vars: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'string') {
      result[k] = interpolate(v, vars)
    } else if (typeof v === 'object' && v !== null) {
      result[k] = interpolateConfig(v as Record<string, unknown>, vars)
    } else {
      result[k] = v
    }
  }
  return result
}

function buildTopologicalOrder(
  nodes: AutomationNode[],
  edges: AutomationEdge[],
  triggerNodeId: string
): AutomationNode[] {
  const visited = new Set<string>()
  const order: AutomationNode[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const outgoing = edges.filter((e) => e.source === id || e.source_node_id === id)
    for (const edge of outgoing) {
      const targetId = edge.target || edge.target_node_id!
      visit(targetId)
    }
    const node = nodeMap.get(id)
    if (node) order.unshift(node)
  }

  visit(triggerNodeId)
  return order
}

async function getSettings(): Promise<Settings> {
  const { data } = await supabase.from('settings').select('*').single()
  return data as Settings
}

async function getClient(clientId: string): Promise<Client> {
  const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
  return data as Client
}

async function getCampaigns(clientId: string): Promise<Campaign[]> {
  const { data } = await supabase.from('campaigns').select('*').eq('client_id', clientId)
  return (data || []) as Campaign[]
}

export async function executeAutomation(
  automationId: string,
  triggerPayload?: unknown
): Promise<string> {
  // Create execution log
  const { data: logRecord } = await supabase
    .from('execution_logs')
    .insert({
      automation_id: automationId,
      status: 'running',
      log_data: [],
    })
    .select()
    .single()

  if (!logRecord) throw new Error('Falha ao criar registro de execução')

  const executionId = logRecord.id
  const nodeLogs: NodeLog[] = []

  async function updateLog(status: 'running' | 'success' | 'error') {
    await supabase.from('execution_logs').update({
      status,
      finished_at: status !== 'running' ? new Date().toISOString() : undefined,
      log_data: nodeLogs,
    }).eq('id', executionId)
  }

  try {
    // Load automation data
    const { data: automation } = await supabase
      .from('automations')
      .select('*, automation_nodes(*), automation_edges(*)')
      .eq('id', automationId)
      .single()

    if (!automation) throw new Error('Automação não encontrada')

    const { data: client } = automation.client_id
      ? await supabase.from('clients').select('*').eq('id', automation.client_id).single()
      : { data: null }
    const campaigns = automation.client_id ? await getCampaigns(automation.client_id) : []
    const settings = await getSettings()

    const context: ExecutionContext = {
      client: client as Client,
      campaigns,
      settings: settings || ({} as Settings),
      executionId,
      triggerPayload,
    }

    const nodes = (automation.automation_nodes || []) as AutomationNode[]
    const edges = (automation.automation_edges || []) as AutomationEdge[]

    // Find trigger node
    const triggerNode = nodes.find((n) => n.type.startsWith('trigger.'))
    if (!triggerNode) throw new Error('Nenhum nó de trigger encontrado na automação')

    // Build execution order
    const ordered = buildTopologicalOrder(nodes, edges, triggerNode.id)

    // Build template vars
    const templateVars: Record<string, unknown> = {
      hoje: new Date().toLocaleDateString('pt-BR'),
      semana_atual: `semana de ${getWeekRange()}`,
      mes_atual: new Date().toLocaleDateString('pt-BR', { month: 'long' }),
      data_formatada: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      cliente: client ? {
        nome: client.name,
        tipo_negocio: client.business_type,
        contexto: client.context,
        whatsapp: client.whatsapp,
        instagram_account_id: client.instagram_account_id || '',
      } : {},
      campanhas: {
        todas: context.campaigns,
      },
      input: triggerPayload,
    }

    let lastOutput: unknown = triggerPayload

    // Execute each node
    for (const node of ordered) {
      if (node.type.startsWith('trigger.')) {
        // Triggers are just starting points
        // For instagram trigger, inject client's instagram_account_id as fallback
        const triggerOutput = node.type === 'trigger.instagram'
          ? {
              ...(triggerPayload as Record<string, unknown> || {}),
              instagram_account_id: (triggerPayload as Record<string, unknown>)?.instagram_account_id
                || context.client?.instagram_account_id
                || '',
            }
          : triggerPayload

        nodeLogs.push({
          node_id: node.id,
          node_type: node.type,
          node_label: node.label || node.type,
          status: 'success',
          input: triggerPayload,
          output: triggerOutput,
          duration_ms: 0,
        })
        lastOutput = triggerOutput
        templateVars.input = triggerOutput
        continue
      }

      const startTime = Date.now()
      const interpolatedConfig = interpolateConfig(node.config, templateVars)

      try {
        const output = await executeNode(node, interpolatedConfig, lastOutput, context)
        const duration = Date.now() - startTime

        lastOutput = output
        templateVars.input = output

        // Add nested keys if object
        if (output && typeof output === 'object') {
          Object.assign(templateVars, { ...templateVars, ...flattenOutput(output as Record<string, unknown>) })
        }

        nodeLogs.push({
          node_id: node.id,
          node_type: node.type,
          node_label: node.label || node.type,
          status: 'success',
          input: lastOutput,
          output,
          duration_ms: duration,
        })

        await updateLog('running')
      } catch (err) {
        const duration = Date.now() - startTime
        const message = err instanceof Error ? err.message : String(err)

        nodeLogs.push({
          node_id: node.id,
          node_type: node.type,
          node_label: node.label || node.type,
          status: 'error',
          input: lastOutput,
          output: null,
          error: message,
          duration_ms: duration,
        })

        await updateLog('error')
        throw err
      }
    }

    // Update automation last run
    await supabase.from('automations').update({ last_run_at: new Date().toISOString() }).eq('id', automationId)
    await updateLog('success')

    return executionId
  } catch (err) {
    await updateLog('error')
    return executionId  // Always return executionId so frontend can check logs
  }
}

function flattenOutput(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    const k = prefix ? `${prefix}.${key}` : key
    result[k] = val
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenOutput(val as Record<string, unknown>, k))
    }
  }
  return result
}

function getWeekRange(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

async function executeNode(
  node: AutomationNode,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const [category, action] = node.type.split('.')

  switch (category) {
    case 'meta':
      return executeMeta(action, config, input, context)
    case 'ai':
      return executeAI(action, config, input, context)
    case 'whatsapp':
      return executeWhatsapp(action, config, input, context)
    case 'logic':
      return executeLogic(action, config, input, context)
    case 'util':
      return executeUtil(action, config, input, context)
    case 'notion':
      return executeNotion(action, config, input, context)
    case 'drive':
      return executeDrive(action, config, input, context)
    default:
      return input
  }
}

// ─── META ─────────────────────────────────────────────────────────────────────

async function executeMeta(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const token = context.client?.meta_token || context.settings.meta_token
  if (!token) throw new Error('Token Meta não configurado')

  const meta = new MetaService(token, context.client?.ad_account_id || '')

  const periodMap: Record<string, string> = {
    '7d': 'last_7d',
    '14d': 'last_14d',
    '30d': 'last_30d',
    'this_month': 'this_month',
    'yesterday': 'yesterday',
    'today': 'today',
    'last_3d': 'last_3d',
    'last_90_days': 'last_90d',
  }

  switch (action) {
    // ── Leitura ──────────────────────────────────────────────────────────
    case 'fetch_campaigns': {
      const campaigns = await meta.getCampaigns(config.status as string | undefined)
      return { campanhas: campaigns, total: campaigns.length }
    }

    case 'fetch_adsets': {
      const adsets = await meta.getAdSets(config.campaign_id as string | undefined)
      return { adsets, total: adsets.length }
    }

    case 'fetch_ads': {
      const parentType = (config.parent_type as 'campaign' | 'adset' | 'account') || 'account'
      const ads = await meta.getAds(config.parent_id as string | undefined, parentType)
      return { anuncios: ads, total: ads.length }
    }

    case 'fetch_metrics': {
      const period = (config.period as string) || '7d'
      const metrics = await meta.getMetrics(
        (config.object_id as string) || null,
        periodMap[period] || period,
        (config.metrics as string[]) || [],
        config.breakdown as string
      )
      return { metricas: metrics }
    }

    case 'fetch_creative_insights': {
      const insights = await meta.getCreativeInsights(config.ad_id as string | undefined)
      return { insights, total: insights.length }
    }

    case 'fetch_instagram_posts': {
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      const instagramId = (config.instagram_account_id as string)
        || (inputRecord.instagram_account_id as string)
        || context.client?.instagram_account_id
      if (!instagramId) throw new Error('ID da conta Instagram não configurado. Configure no bloco ou no cadastro do cliente.')
      const posts = await meta.getInstagramPosts(
        instagramId,
        (config.limit as number) || 20,
        (config.media_type as string) || undefined,
        (config.period as string) || undefined,
        (config.date_from as string) || undefined,
        (config.date_to as string) || undefined,
      )
      return { posts, total: posts.length, instagram_account_id: instagramId }
    }

    case 'fetch_audiences': {
      const audiences = await meta.getAudiences()
      return { publicos: audiences, total: audiences.length }
    }

    // ── Criação ──────────────────────────────────────────────────────────
    case 'create_campaign': {
      const result = await meta.createCampaign({
        name: config.name as string,
        objective: config.objective as string,
        status: (config.status as string) || 'PAUSED',
        daily_budget: config.daily_budget as number | undefined,
        lifetime_budget: config.lifetime_budget as number | undefined,
        start_time: config.start_time as string | undefined,
        stop_time: config.stop_time as string | undefined,
        special_ad_categories: (config.special_ad_categories as string[]) || [],
      })
      return { campanha_criada: result, campaign_id: result.id }
    }

    case 'create_adset': {
      const targeting = config.targeting
        ? (typeof config.targeting === 'string' ? JSON.parse(config.targeting) : config.targeting)
        : { geo_locations: { countries: ['BR'] } }
      const result = await meta.createAdSet({
        campaign_id: config.campaign_id as string,
        name: config.name as string,
        optimization_goal: (config.optimization_goal as string) || 'REACH',
        billing_event: (config.billing_event as string) || 'IMPRESSIONS',
        daily_budget: config.daily_budget as number | undefined,
        lifetime_budget: config.lifetime_budget as number | undefined,
        bid_amount: config.bid_amount as number | undefined,
        targeting,
        status: (config.status as string) || 'PAUSED',
        start_time: config.start_time as string | undefined,
        end_time: config.end_time as string | undefined,
      })
      return { adset_criado: result, adset_id: result.id }
    }

    case 'create_ad': {
      // Se vier source_instagram_media_id, cria criativo a partir de post existente do Instagram
      if (config.source_instagram_media_id) {
        const instagramAccountId = (config.instagram_actor_id as string) || context.client?.instagram_account_id
        if (!instagramAccountId) throw new Error('ID da conta Instagram não encontrado. Configure no cadastro do cliente.')
        const result = await meta.createAdFromInstagramPost({
          postId: config.source_instagram_media_id as string,
          instagramAccountId,
          adsetId: config.adset_id as string,
          adName: (config.name as string) || `Post ${config.source_instagram_media_id}`,
          status: (config.status as string) || 'PAUSED',
        })
        return { anuncio_criado: result, ad_id: result.ad_id, creative_id: result.creative_id }
      }

      const result = await meta.createAd({
        adset_id: config.adset_id as string,
        name: config.name as string,
        creative_id: config.creative_id as string | undefined,
        title: config.title as string | undefined,
        body: config.body as string | undefined,
        image_url: config.image_url as string | undefined,
        video_id: config.video_id as string | undefined,
        link_url: config.link_url as string | undefined,
        call_to_action: config.call_to_action as string | undefined,
        page_id: config.page_id as string | undefined,
        instagram_actor_id: config.instagram_actor_id as string | undefined,
        status: (config.status as string) || 'PAUSED',
      })
      return { anuncio_criado: result, ad_id: result.id }
    }

    case 'boost_post': {
      const targeting = config.targeting
        ? (typeof config.targeting === 'string' ? JSON.parse(config.targeting) : config.targeting)
        : { geo_locations: { countries: ['BR'] }, age_min: 18, age_max: 65 }
      const result = await meta.boostPost({
        post_id: config.post_id as string,
        page_id: config.page_id as string,
        daily_budget: (config.daily_budget as number) || 10,
        duration_days: (config.duration_days as number) || 7,
        targeting,
        optimization_goal: config.optimization_goal as string | undefined,
      })
      return { boost_criado: result, ...result }
    }

    case 'filter_unsponsored_posts': {
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      // source_posts: user can specify {{posts}} from any previous node; after interpolation it becomes a JSON string
      // Falls back to input.posts or input.input.posts (when preceded by logic.if which wraps input)
      let posts: Array<{ id: string; timestamp: string; media_type: string }> = []
      const sourcePosts = config.source_posts as string | undefined
      if (sourcePosts && sourcePosts.trim()) {
        try { posts = JSON.parse(sourcePosts) } catch { posts = [] }
      } else {
        posts = (inputRecord.posts as Array<{ id: string; timestamp: string; media_type: string }>)
          || ((inputRecord.input as Record<string, unknown>)?.posts as Array<{ id: string; timestamp: string; media_type: string }>)
          || []
      }
      const instagramAccountId = (config.instagram_account_id as string)
        || (inputRecord.instagram_account_id as string)
        || context.client?.instagram_account_id
      const clientId = context.client?.id

      if (!posts.length) return { posts: [], total: 0, posts_pulados: 0, instagram_account_id: instagramAccountId }

      // 1. Posts já registrados na nossa tabela
      const { data: alreadySponsored } = await supabase
        .from('sponsored_posts')
        .select('post_id')
        .eq('client_id', clientId)
      const sponsoredIds = new Set((alreadySponsored || []).map((r: { post_id: string }) => r.post_id))

      // 2. Verificar via Meta API uma única vez (em vez de N chamadas no loop)
      //    GET /ads?fields=creative{source_instagram_media_id}&filtering=[effective_status IN [...]]
      const metaSponsoredIds = await meta.getSponsoredInstagramPostIds()
      const toUpsert: Array<{ client_id: string; instagram_account_id: string; post_id: string }> = []
      for (const post of posts) {
        if (!sponsoredIds.has(post.id) && metaSponsoredIds.has(post.id)) {
          sponsoredIds.add(post.id)
          toUpsert.push({ client_id: clientId as string, instagram_account_id: instagramAccountId as string, post_id: post.id })
        }
      }
      if (toUpsert.length) {
        await supabase.from('sponsored_posts').upsert(toUpsert, { onConflict: 'client_id,post_id', ignoreDuplicates: true })
      }

      const filteredPosts = posts.filter((p) => !sponsoredIds.has(p.id))
      return {
        posts: filteredPosts,
        total: filteredPosts.length,
        posts_pulados: posts.length - filteredPosts.length,
        instagram_account_id: instagramAccountId,
      }
    }

    case 'create_ads_from_new_posts': {
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      const posts = (inputRecord.posts as Array<{ id: string; timestamp: string; media_type: string }>) || []
      const instagramAccountId = (config.instagram_account_id as string)
        || (inputRecord.instagram_account_id as string)
        || context.client?.instagram_account_id
      const clientId = context.client?.id

      if (!posts.length) return { ads_criados: 0, posts_pulados: 0, detalhes: [] }
      if (!instagramAccountId) throw new Error('ID da conta Instagram não encontrado. Configure no cadastro do cliente.')
      if (!clientId) throw new Error('Cliente não identificado no contexto da automação.')

      // 1. Posts já registrados na nossa tabela (criados pelo FlowAds)
      const { data: alreadySponsored } = await supabase
        .from('sponsored_posts')
        .select('post_id')
        .eq('client_id', clientId)
      const sponsoredIds = new Set((alreadySponsored || []).map((r: { post_id: string }) => r.post_id))

      // 2. Verificar via Meta API uma única vez
      const metaSponsoredIds2 = await meta.getSponsoredInstagramPostIds()
      const toUpsert2: Array<{ client_id: string; instagram_account_id: string; post_id: string }> = []
      for (const post of posts) {
        if (!sponsoredIds.has(post.id) && metaSponsoredIds2.has(post.id)) {
          sponsoredIds.add(post.id)
          toUpsert2.push({ client_id: clientId as string, instagram_account_id: instagramAccountId as string, post_id: post.id })
        }
      }
      if (toUpsert2.length) {
        await supabase.from('sponsored_posts').upsert(toUpsert2, { onConflict: 'client_id,post_id', ignoreDuplicates: true })
      }

      // Filtrar apenas posts novos (não patrocinados em nenhuma fonte)
      const newPosts = posts.filter((p) => !sponsoredIds.has(p.id))

      if (!newPosts.length) return { ads_criados: 0, posts_pulados: posts.length, detalhes: [] }

      const adsetId = config.adset_id as string
      if (!adsetId) throw new Error('ID do conjunto de anúncios (adset_id) não configurado no bloco.')

      const status = (config.status as string) || 'ACTIVE'
      const detalhes: Array<{ post_id: string; ad_id?: string; status: string; error?: string }> = []

      for (const post of newPosts) {
        try {
          const adName = `Post ${post.id} - ${new Date(post.timestamp).toLocaleDateString('pt-BR')}`
          const result = await meta.createAdFromInstagramPost({
            postId: post.id,
            instagramAccountId,
            adsetId,
            adName,
            status,
          })
          await supabase.from('sponsored_posts').insert({
            client_id: clientId,
            instagram_account_id: instagramAccountId,
            post_id: post.id,
            ad_id: result.ad_id,
            adset_id: adsetId,
          })
          detalhes.push({ post_id: post.id, ad_id: result.ad_id, status: 'criado' })
        } catch (err) {
          detalhes.push({ post_id: post.id, status: 'erro', error: String(err) })
        }
      }

      const ads_criados = detalhes.filter((d) => d.status === 'criado').length
      return {
        ads_criados,
        posts_pulados: posts.length - newPosts.length,
        patrocinados_externamente: toUpsert2.length,
        detalhes,
      }
    }

    case 'duplicate_campaign': {
      const result = await meta.duplicateCampaign(
        config.campaign_id as string,
        config.new_name as string | undefined
      )
      return { campanha_duplicada: result, campaign_id: result.id }
    }

    case 'create_audience': {
      const result = await meta.createCustomAudience({
        name: config.name as string,
        description: config.description as string | undefined,
        subtype: (config.subtype as 'CUSTOM' | 'WEBSITE' | 'APP' | 'LOOKALIKE') || 'WEBSITE',
        pixel_id: config.pixel_id as string | undefined,
        rule: config.rule as Record<string, unknown> | undefined,
        lookalike_spec: config.lookalike_spec as Record<string, unknown> | undefined,
      })
      return { publico_criado: result, audience_id: result.id }
    }

    // ── Edição ───────────────────────────────────────────────────────────
    case 'edit_campaign': {
      await meta.editCampaign(config.campaign_id as string, {
        name: config.name as string | undefined,
        status: config.status as string | undefined,
        daily_budget: config.daily_budget as number | undefined,
        lifetime_budget: config.lifetime_budget as number | undefined,
        stop_time: config.stop_time as string | undefined,
      })
      return { editado: true, campaign_id: config.campaign_id }
    }

    case 'edit_adset': {
      await meta.editAdSet(config.adset_id as string, {
        name: config.name as string | undefined,
        status: config.status as string | undefined,
        daily_budget: config.daily_budget as number | undefined,
        targeting: config.targeting as Record<string, unknown> | undefined,
        end_time: config.end_time as string | undefined,
      })
      return { editado: true, adset_id: config.adset_id }
    }

    case 'edit_ad': {
      await meta.editAd(config.ad_id as string, {
        name: config.name as string | undefined,
        status: config.status as string | undefined,
        creative_id: config.creative_id as string | undefined,
      })
      return { editado: true, ad_id: config.ad_id }
    }

    case 'adjust_budget': {
      const objectId = (config.campaign_id || config.adset_id || config.object_id) as string
      if (!objectId) throw new Error('ID do objeto não configurado')
      await meta.updateBudget(objectId, {
        daily_budget: config.daily_budget as number | undefined,
        lifetime_budget: config.lifetime_budget as number | undefined,
      })
      return { budget_atualizado: true, object_id: objectId }
    }

    // ── Status ───────────────────────────────────────────────────────────
    case 'pause_ad': {
      const id = (config.ad_id || config.adset_id || config.campaign_id || config.object_id) as string
      if (!id) throw new Error('ID do objeto não configurado')
      await meta.pauseObject(id)
      return { pausado: true, object_id: id }
    }

    case 'activate_ad': {
      const id = (config.ad_id || config.adset_id || config.campaign_id || config.object_id) as string
      if (!id) throw new Error('ID do objeto não configurado')
      await meta.activateObject(id)
      return { ativado: true, object_id: id }
    }

    case 'delete_object': {
      const id = (config.object_id || config.ad_id || config.adset_id || config.campaign_id) as string
      if (!id) throw new Error('ID do objeto não configurado')
      await meta.deleteObject(id)
      return { excluido: true, object_id: id }
    }

    case 'boost_post': {
      const instagramAccountId = (config.instagram_account_id as string)
        || context.client?.instagram_account_id
        || ''
      if (!instagramAccountId) throw new Error('Perfil do Instagram não configurado para este cliente')
      return { instagram_account_id: instagramAccountId, boosted: true }
    }


    default:
      return input
  }
}

// ─── AI ───────────────────────────────────────────────────────────────────────

async function executeAI(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const model = (config.model as string) || 'gpt-4o'
  const isAnthropic = model.startsWith('claude')

  const request = {
    model,
    systemPrompt: (config.system_prompt as string) || '',
    humanMessage: (config.human_message as string) || '',
    temperature: (config.temperature as number) ?? 0.7,
    maxTokens: (config.max_tokens as number) ?? 1000,
    outputFormat: (config.output_format as 'text' | 'json') || 'text',
    outputSchema: config.output_schema as Record<string, unknown>,
  }

  let result
  if (isAnthropic) {
    if (!context.settings.anthropic_key) throw new Error('Anthropic API key não configurada')
    const svc = new AnthropicService(context.settings.anthropic_key)
    result = await svc.complete(request)
  } else {
    if (!context.settings.openai_key) throw new Error('OpenAI API key não configurada')
    const svc = new OpenAIService(context.settings.openai_key)
    result = await svc.complete(request)
  }

  // Save to memory if enabled
  if (config.memory_enabled) {
    await supabase.from('agent_memory').insert([
      { agent_id: config.agent_id, client_id: context.client?.id, execution_id: context.executionId, role: 'user', content: request.humanMessage },
      { agent_id: config.agent_id, client_id: context.client?.id, execution_id: context.executionId, role: 'assistant', content: result.content },
    ])
  }

  return result.parsed || result.content
}

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────

async function executeWhatsapp(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  if (!context.settings.whatsapp_url || !context.settings.whatsapp_token) {
    throw new Error('WhatsApp API não configurada')
  }

  const wa = new WhatsAppService(
    context.settings.whatsapp_url!,
    context.settings.whatsapp_token!,
    context.settings.whatsapp_instance || 'default'
  )
  const number = config.number_type === 'client'
    ? `55${context.client?.whatsapp?.replace(/\D/g, '') ?? ''}`
    : (config.number as string)

  switch (action) {
    case 'send_message':
    case 'send_report': {
      await wa.sendMessage(number, config.message as string)
      return { sent: true, to: number }
    }
    case 'send_file': {
      await wa.sendFile(number, config.file_url as string)
      return { sent: true, to: number }
    }
    default:
      return input
  }
}

// ─── LOGIC ────────────────────────────────────────────────────────────────────

async function executeLogic(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  _context: ExecutionContext
): Promise<unknown> {
  switch (action) {
    case 'wait': {
      const ms =
        (config.duration as number) *
        (config.unit === 'minutes' ? 60000 : config.unit === 'hours' ? 3600000 : 1000)
      await new Promise((r) => setTimeout(r, Math.min(ms, 30000))) // max 30s in execution
      return input
    }

    case 'if': {
      const { variable, operator, value } = config as Record<string, string>
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      const rawVar = variable !== undefined ? String(variable) : ''
      // If variable is a plain key name (no {{}} in original, interpolation left it unchanged),
      // look it up in the input object. If it was already interpolated (e.g. "11"), use as-is.
      const actual = (rawVar && Object.prototype.hasOwnProperty.call(inputRecord, rawVar))
        ? String(inputRecord[rawVar])
        : rawVar !== '' ? rawVar : String(input)
      let result = false
      switch (operator) {
        case '>': result = parseFloat(actual) > parseFloat(value); break
        case '<': result = parseFloat(actual) < parseFloat(value); break
        case '>=': result = parseFloat(actual) >= parseFloat(value); break
        case '<=': result = parseFloat(actual) <= parseFloat(value); break
        case '=': result = actual === value; break
        case '!=': result = actual !== value; break
        case 'contains': result = actual.includes(value); break
        case 'not_contains': result = !actual.includes(value); break
        case 'is_empty': result = !actual || actual === 'null' || actual === 'undefined'; break
        case 'not_empty': result = !!actual && actual !== 'null' && actual !== 'undefined'; break
      }
      return { condition: result, input }
    }

    case 'loop': {
      // Resolve the list from input
      const listPath = config.list as string
      let list: unknown[] = []
      if (Array.isArray(input)) {
        list = input
      } else if (listPath && input && typeof input === 'object') {
        const keys = listPath.replace(/\{\{|\}\}/g, '').trim().split('.')
        let val: unknown = input
        for (const k of keys) val = (val as Record<string, unknown>)?.[k]
        if (Array.isArray(val)) list = val
      }
      const maxIter = (config.max_iterations as number) || 100
      return { items: list.slice(0, maxIter), total: list.length, item_var: config.item_var || 'item' }
    }

    case 'merge': {
      // Merge two inputs - input is the latest, but both paths arrive here
      if (input && typeof input === 'object' && !Array.isArray(input)) {
        const a = (config.data_a as Record<string, unknown>) || {}
        const b = (config.data_b as Record<string, unknown>) || {}
        return { ...a, ...b, ...(input as Record<string, unknown>) }
      }
      return input
    }

    case 'filter': {
      if (!Array.isArray(input)) return input
      const { field, operator, value } = config as Record<string, string>
      if (!field || !operator) return input
      return input.filter((item) => {
        const itemVal = String((item as Record<string, unknown>)?.[field] ?? '')
        switch (operator) {
          case '>': return parseFloat(itemVal) > parseFloat(value)
          case '<': return parseFloat(itemVal) < parseFloat(value)
          case '>=': return parseFloat(itemVal) >= parseFloat(value)
          case '<=': return parseFloat(itemVal) <= parseFloat(value)
          case '=': return itemVal === value
          case '!=': return itemVal !== value
          case 'contains': return itemVal.includes(value)
          case 'not_contains': return !itemVal.includes(value)
          case 'is_empty': return !itemVal
          case 'not_empty': return !!itemVal
          default: return true
        }
      })
    }

    case 'transform': {
      const template = config.template as string
      if (!template) return input
      // Try JSON parse first (for object templates), then return as string
      try { return JSON.parse(template) } catch { return template }
    }

    case 'stop': {
      // If preceded by a logic.if, only stop when the condition was false.
      // When condition is true we're on the inactive branch — pass through silently.
      const conditionValue = (input as Record<string, unknown>)?.condition
      if (typeof conditionValue === 'boolean' && conditionValue === true) {
        return input // inactive branch — skip this stop
      }
      throw new Error('FLOW_STOPPED')
    }

    default:
      return input
  }
}

// ─── UTIL ─────────────────────────────────────────────────────────────────────

async function executeUtil(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  _context: ExecutionContext
): Promise<unknown> {
  switch (action) {
    case 'http': {
      const { method, url, headers: headerList, body, auth, auth_token } = config as Record<string, unknown>
      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' }

      if (Array.isArray(headerList)) {
        for (const h of headerList as { key: string; value: string }[]) {
          if (h.key) reqHeaders[h.key] = h.value
        }
      }

      if (auth === 'bearer' && auth_token) {
        reqHeaders['Authorization'] = `Bearer ${auth_token}`
      }

      const res = await fetch(url as string, {
        method: (method as string) || 'GET',
        headers: reqHeaders,
        body: method !== 'GET' && body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      })

      const text = await res.text()
      try { return JSON.parse(text) } catch { return text }
    }

    case 'format_text': {
      return { [config.output_var as string || 'texto']: config.template || '' }
    }

    case 'log': {
      console.log('[FlowAds Log]', config.label ? `[${config.label}]` : '', input)
      return input
    }

    case 'set_variable': {
      const varName = config.variable as string
      const varValue = config.value
      if (!varName) return input
      return { ...(input && typeof input === 'object' ? input as Record<string, unknown> : {}), [varName]: varValue }
    }

    default:
      return input
  }
}

// ─── NOTION ───────────────────────────────────────────────────────────────────

async function executeNotion(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const token = context.settings.notion_token
  if (!token) throw new Error('Token Notion não configurado. Configure em Configurações.')

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  }

  switch (action) {
    case 'create_page': {
      const properties = config.properties
        ? (typeof config.properties === 'string' ? JSON.parse(config.properties) : config.properties)
        : {}
      const children = config.content
        ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: config.content as string } }] } }]
        : []
      const body: Record<string, unknown> = {
        parent: { database_id: config.database_id },
        properties,
      }
      if (children.length) body.children = children
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error((data.message as string) || 'Erro ao criar página Notion')
      return { page_id: data.id, url: data.url, criado: true }
    }

    case 'search_pages': {
      const filter = config.filter
        ? (typeof config.filter === 'string' ? JSON.parse(config.filter) : config.filter)
        : undefined
      const sorts = config.sorts
        ? (typeof config.sorts === 'string' ? JSON.parse(config.sorts) : config.sorts)
        : undefined
      const body: Record<string, unknown> = { page_size: (config.limit as number) || 10 }
      if (filter) body.filter = filter
      if (sorts) body.sorts = sorts
      const res = await fetch(`https://api.notion.com/v1/databases/${config.database_id}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json() as { results?: unknown[] }
      if (!res.ok) throw new Error('Erro ao buscar páginas Notion')
      return { paginas: data.results || [], total: (data.results || []).length }
    }

    case 'update_page': {
      const properties = config.properties
        ? (typeof config.properties === 'string' ? JSON.parse(config.properties) : config.properties)
        : {}
      const res = await fetch(`https://api.notion.com/v1/pages/${config.page_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ properties }),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error('Erro ao atualizar página Notion')
      return { page_id: data.id, atualizado: true }
    }

    case 'read_database': {
      const res = await fetch(`https://api.notion.com/v1/databases/${config.database_id}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ page_size: (config.limit as number) || 100 }),
      })
      const data = await res.json() as { results?: unknown[] }
      if (!res.ok) throw new Error('Erro ao ler database Notion')
      return { registros: data.results || [], total: (data.results || []).length }
    }

    default:
      return input
  }
}

// ─── DRIVE ────────────────────────────────────────────────────────────────────

async function executeDrive(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const token = context.settings.drive_token
  if (!token) throw new Error('Token Google Drive não configurado. Configure em Configurações.')

  const authHeader = { 'Authorization': `Bearer ${token}` }

  switch (action) {
    case 'list_files': {
      const folderId = config.folder_id as string
      const query = folderId
        ? `'${folderId}' in parents and trashed = false`
        : 'trashed = false'
      const params = new URLSearchParams({
        q: query,
        fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
        pageSize: String((config.limit as number) || 50),
      })
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: authHeader })
      const data = await res.json() as { files?: unknown[] }
      if (!res.ok) throw new Error('Erro ao listar arquivos do Drive')
      return { arquivos: data.files || [], total: (data.files || []).length }
    }

    case 'download_file': {
      const fileId = config.file_id as string
      // Get file metadata
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
        { headers: authHeader }
      )
      const meta = await metaRes.json() as Record<string, unknown>
      // Get download URL
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
      return { file_id: fileId, name: meta.name, mimeType: meta.mimeType, download_url: downloadUrl }
    }

    case 'upload_file': {
      const metadata = {
        name: config.file_name as string || 'arquivo',
        parents: config.folder_id ? [config.folder_id] : [],
      }
      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            ...authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...metadata, description: config.description }),
        }
      )
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error('Erro ao fazer upload para o Drive')
      return { file_id: data.id, name: data.name, enviado: true }
    }

    case 'create_folder': {
      const body = {
        name: config.folder_name as string || 'Nova pasta',
        mimeType: 'application/vnd.google-apps.folder',
        parents: config.parent_id ? [config.parent_id] : [],
      }
      const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error('Erro ao criar pasta no Drive')
      return { folder_id: data.id, name: data.name, criado: true }
    }

    default:
      return input
  }
}
