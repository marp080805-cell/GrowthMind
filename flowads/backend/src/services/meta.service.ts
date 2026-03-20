const META_API = 'https://graph.facebook.com/v21.0'

export interface MetaAccount {
  id: string
  name: string
  currency: string
}

export interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  stop_time?: string
}

export interface MetaAdSet {
  id: string
  name: string
  status: string
  campaign_id: string
  daily_budget?: string
  lifetime_budget?: string
  targeting?: Record<string, unknown>
  optimization_goal?: string
  billing_event?: string
  bid_amount?: string
  start_time?: string
  end_time?: string
}

export interface MetaAd {
  id: string
  name: string
  status: string
  adset_id: string
  campaign_id: string
  creative?: { id: string }
  created_time?: string
}

export interface MetaMetrics {
  impressoes: number
  alcance: number
  cliques: number
  ctr: number
  cpc: number
  cpm: number
  gasto: number
  roas?: number
  frequencia?: number
  // Resultado principal
  engajamentos?: number
  leads?: number
  compras?: number
  seguidores?: number         // page likes / follows from ad
  conversas_iniciadas?: number
  adicoes_carrinho?: number
  visualizacoes_video?: number // 3-second views
  thruplay?: number           // completed views (ThruPlay)
  // Custo por resultado
  cpe?: number
  cpl?: number
  custo_mensagem?: number
  custo_compra?: number
  custo_seguidor?: number     // gasto / seguidores (calculado)
  custo_conversa?: number
  custo_adicao?: number       // custo por adição ao carrinho
  custo_thruplay?: number
  // Qualidade / vídeo
  cliques_link?: number
  hook_rate?: number          // visualizacoes_video / impressoes * 100
  // Retorno
  receita?: number            // purchase_value total
  periodo: string
}

export interface MetaAudience {
  id: string
  name: string
  subtype: string
  approximate_count?: number
  description?: string
}

export interface MetaInstagramPost {
  id: string
  caption?: string
  media_type: string
  media_product_type?: string
  media_url?: string
  permalink: string
  timestamp: string
  like_count?: number
  comments_count?: number
}

export interface MetaInstagramAccount {
  id: string
  name: string
  username: string
}

async function metaPost(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Meta Graph API is form-encoded by design; complex fields are JSON strings
  const formData = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'object') {
      formData.set(key, JSON.stringify(value))
    } else {
      formData.set(key, String(value))
    }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })
  const data = await res.json() as Record<string, unknown> & { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string; error_user_title?: string } }
  if (!res.ok || data.error) {
    const e = data.error as { message?: string; code?: number; error_subcode?: number; error_user_msg?: string; error_user_title?: string } | undefined
    const code = e?.code ? ` [código ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}]` : ''
    const detail = e?.error_user_msg ? ` — ${e.error_user_msg}` : ''
    throw new Error((e?.message || 'Erro na API do Meta') + code + detail)
  }
  return data
}

async function metaGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const data = await res.json() as T & { error?: { message?: string } }
  if (!res.ok || (data as Record<string, unknown>).error) {
    throw new Error(((data as Record<string, unknown>).error as { message?: string })?.message || 'Erro na API do Meta')
  }
  return data
}

interface MetaPagedResponse<T> {
  data?: T[]
  paging?: { next?: string }
}

// Busca todas as páginas de paginação automática do Meta
async function metaGetAll<T>(url: string): Promise<T[]> {
  const results: T[] = []
  let nextUrl: string | null = url
  while (nextUrl) {
    const page: MetaPagedResponse<T> = await metaGet<MetaPagedResponse<T>>(nextUrl)
    for (const item of page.data || []) results.push(item)
    nextUrl = page.paging?.next || null
  }
  return results
}

export class MetaService {
  constructor(private token: string, private adAccountId: string) {
    // Normalize: strip leading 'act_' to avoid act_act_ duplication
    this.adAccountId = adAccountId.replace(/^act_/, '')
  }

  private get accountUrl() {
    return `${META_API}/act_${this.adAccountId}`
  }

  private tokenParam(extra?: Record<string, string>) {
    const p = new URLSearchParams({ access_token: this.token, ...extra })
    return p.toString()
  }

  // ─── Validation ──────────────────────────────────────────────────────────

  async validateToken(): Promise<{ valid: boolean; accounts: MetaAccount[] }> {
    const accounts = await metaGetAll<MetaAccount>(
      `${META_API}/me/adaccounts?fields=id,name,currency&limit=200&access_token=${this.token}`
    )
    return { valid: true, accounts }
  }

  // ─── Campaigns ───────────────────────────────────────────────────────────

  async getCampaigns(status?: string): Promise<MetaCampaign[]> {
    const params = new URLSearchParams({
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time',
      access_token: this.token,
    })
    if (status) params.set('filtering', JSON.stringify([{ field: 'campaign.delivery_status', operator: 'IN', value: [status] }]))
    const data = await metaGet<{ data?: MetaCampaign[] }>(`${this.accountUrl}/campaigns?${params}`)
    return data.data || []
  }

  async createCampaign(params: {
    name: string
    objective: string
    status?: string
    daily_budget?: number
    lifetime_budget?: number
    start_time?: string
    stop_time?: string
    special_ad_categories?: string[]
  }): Promise<{ id: string; name: string }> {
    const body: Record<string, unknown> = {
      name: params.name,
      objective: params.objective,
      status: params.status || 'PAUSED',
      special_ad_categories: params.special_ad_categories || [],
      access_token: this.token,
    }
    if (params.daily_budget) body.daily_budget = Math.round(params.daily_budget * 100)
    if (params.lifetime_budget) body.lifetime_budget = Math.round(params.lifetime_budget * 100)
    if (params.start_time) body.start_time = params.start_time
    if (params.stop_time) body.stop_time = params.stop_time
    const data = await metaPost(`${this.accountUrl}/campaigns`, body)
    return { id: data.id as string, name: params.name }
  }

  async editCampaign(campaignId: string, params: {
    name?: string
    status?: string
    daily_budget?: number
    lifetime_budget?: number
    stop_time?: string
  }): Promise<void> {
    const body: Record<string, unknown> = { access_token: this.token }
    if (params.name) body.name = params.name
    if (params.status) body.status = params.status
    if (params.daily_budget) body.daily_budget = Math.round(params.daily_budget * 100)
    if (params.lifetime_budget) body.lifetime_budget = Math.round(params.lifetime_budget * 100)
    if (params.stop_time) body.stop_time = params.stop_time
    await metaPost(`${META_API}/${campaignId}`, body)
  }

  async duplicateCampaign(campaignId: string, newName?: string): Promise<{ id: string }> {
    const body: Record<string, unknown> = { access_token: this.token }
    if (newName) body.rename_options = { rename_strategy: 'CUSTOM_RENAME', rename_prefix: newName }
    const data = await metaPost(`${META_API}/${campaignId}/copies`, body)
    const copies = (data.copies as { id: string }[] | undefined)
    return { id: copies?.[0]?.id || data.id as string }
  }

  // ─── Ad Sets ─────────────────────────────────────────────────────────────

  async getAdSets(campaignId?: string): Promise<MetaAdSet[]> {
    const url = campaignId
      ? `${META_API}/${campaignId}/adsets`
      : `${this.accountUrl}/adsets`
    const params = new URLSearchParams({
      fields: 'id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,bid_amount,start_time,end_time',
      access_token: this.token,
    })
    const data = await metaGet<{ data?: MetaAdSet[] }>(`${url}?${params}`)
    return data.data || []
  }

  async createAdSet(params: {
    campaign_id: string
    name: string
    optimization_goal: string
    billing_event: string
    daily_budget?: number
    lifetime_budget?: number
    bid_amount?: number
    targeting: Record<string, unknown>
    status?: string
    start_time?: string
    end_time?: string
  }): Promise<{ id: string; name: string }> {
    const body: Record<string, unknown> = {
      campaign_id: params.campaign_id,
      name: params.name,
      optimization_goal: params.optimization_goal,
      billing_event: params.billing_event,
      targeting: params.targeting,
      status: params.status || 'PAUSED',
      access_token: this.token,
    }
    if (params.daily_budget) body.daily_budget = Math.round(params.daily_budget * 100)
    if (params.lifetime_budget) body.lifetime_budget = Math.round(params.lifetime_budget * 100)
    if (params.bid_amount) body.bid_amount = Math.round(params.bid_amount * 100)
    if (params.start_time) body.start_time = params.start_time
    if (params.end_time) body.end_time = params.end_time
    const data = await metaPost(`${this.accountUrl}/adsets`, body)
    return { id: data.id as string, name: params.name }
  }

  async editAdSet(adSetId: string, params: {
    name?: string
    status?: string
    daily_budget?: number
    targeting?: Record<string, unknown>
    end_time?: string
  }): Promise<void> {
    const body: Record<string, unknown> = { access_token: this.token }
    if (params.name) body.name = params.name
    if (params.status) body.status = params.status
    if (params.daily_budget) body.daily_budget = Math.round(params.daily_budget * 100)
    if (params.targeting) body.targeting = params.targeting
    if (params.end_time) body.end_time = params.end_time
    await metaPost(`${META_API}/${adSetId}`, body)
  }

  // ─── Ads ─────────────────────────────────────────────────────────────────

  async getAds(parentId?: string, parentType: 'campaign' | 'adset' | 'account' = 'account', statusFilter?: string): Promise<MetaAd[]> {
    const url = parentType === 'account'
      ? `${this.accountUrl}/ads`
      : `${META_API}/${parentId}/ads`
    const params = new URLSearchParams({
      fields: 'id,name,status,adset_id,campaign_id,creative{id},created_time',
      access_token: this.token,
      limit: '500',
    })
    if (statusFilter && statusFilter !== 'ALL') {
      params.set('filtering', JSON.stringify([{ field: 'effective_status', operator: 'IN', value: [statusFilter] }]))
    }
    const data = await metaGet<{ data?: MetaAd[] }>(`${url}?${params}`)
    return data.data || []
  }

  async createAd(params: {
    adset_id: string
    name: string
    creative_id?: string
    // Or inline creative fields:
    title?: string
    body?: string
    image_url?: string
    image_hash?: string
    video_id?: string
    thumbnail_hash?: string
    link_url?: string
    call_to_action?: string
    page_id?: string
    instagram_actor_id?: string
    status?: string
  }): Promise<{ id: string; name: string }> {
    let creativeId = params.creative_id

    if (!creativeId) {
      // Build creative inline
      const objectStorySpec: Record<string, unknown> = {}

      if (params.page_id) {
        const linkData: Record<string, unknown> = {}
        if (params.title) linkData.name = params.title
        if (params.body) linkData.message = params.body
        if (params.link_url) linkData.link = params.link_url
        if (params.image_hash) linkData.image_hash = params.image_hash
        else if (params.image_url) linkData.picture = params.image_url
        if (params.call_to_action) linkData.call_to_action = { type: params.call_to_action }

        if (params.video_id) {
          objectStorySpec.page_id = params.page_id
          objectStorySpec.video_data = {
            video_id: params.video_id,
            image_hash: params.thumbnail_hash || params.image_hash || undefined,
            title: params.title,
            message: params.body,
            call_to_action: params.call_to_action ? { type: params.call_to_action, value: { link: params.link_url } } : undefined,
          }
        } else {
          objectStorySpec.page_id = params.page_id
          objectStorySpec.link_data = linkData
        }

        if (params.instagram_actor_id) objectStorySpec.instagram_actor_id = params.instagram_actor_id
      }

      const creativeBody: Record<string, unknown> = {
        name: `Creative - ${params.name}`,
        object_story_spec: objectStorySpec,
        access_token: this.token,
      }
      let creativeData: Record<string, unknown>
      try {
        creativeData = await metaPost(`${this.accountUrl}/adcreatives`, creativeBody)
      } catch (err) {
        // Re-throw with full creative body for debugging
        const body = JSON.stringify({ page_id: params.page_id, video_id: params.video_id, image_hash: params.image_hash, thumbnail_hash: params.thumbnail_hash, account: this.adAccountId, object_story_spec: objectStorySpec })
        throw new Error(`${(err as Error).message} | DEBUG: ${body}`)
      }
      creativeId = creativeData.id as string
    }

    const adBody = {
      adset_id: params.adset_id,
      name: params.name,
      creative: { creative_id: creativeId },
      status: params.status || 'PAUSED',
      access_token: this.token,
    }
    const data = await metaPost(`${this.accountUrl}/ads`, adBody)
    return { id: data.id as string, name: params.name }
  }

  async editAd(adId: string, params: {
    name?: string
    status?: string
    creative_id?: string
  }): Promise<void> {
    const body: Record<string, unknown> = { access_token: this.token }
    if (params.name) body.name = params.name
    if (params.status) body.status = params.status
    if (params.creative_id) body.creative = { creative_id: params.creative_id }
    await metaPost(`${META_API}/${adId}`, body)
  }

  // ─── Status & Budget ─────────────────────────────────────────────────────

  async pauseObject(objectId: string): Promise<void> {
    await metaPost(`${META_API}/${objectId}`, { status: 'PAUSED', access_token: this.token })
  }

  async activateObject(objectId: string): Promise<void> {
    await metaPost(`${META_API}/${objectId}`, { status: 'ACTIVE', access_token: this.token })
  }

  async deleteObject(objectId: string): Promise<void> {
    const res = await fetch(`${META_API}/${objectId}?access_token=${this.token}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Erro ao excluir objeto')
  }

  async updateBudget(objectId: string, params: {
    daily_budget?: number
    lifetime_budget?: number
  }): Promise<void> {
    const body: Record<string, unknown> = { access_token: this.token }
    if (params.daily_budget !== undefined) body.daily_budget = Math.round(params.daily_budget * 100)
    if (params.lifetime_budget !== undefined) body.lifetime_budget = Math.round(params.lifetime_budget * 100)
    await metaPost(`${META_API}/${objectId}`, body)
  }

  // ─── Metrics ─────────────────────────────────────────────────────────────

  async getMetrics(
    objectId: string | null,
    datePreset: string,
    fields: string[],
    breakdown?: string
  ): Promise<MetaMetrics> {
    const target = objectId
      ? `${META_API}/${objectId}/insights`
      : `${this.accountUrl}/insights`

    const apiFields = [
      'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm', 'spend',
      'purchase_roas', 'frequency', 'inline_link_clicks',
      'actions', 'cost_per_action_type', 'action_values',
      'video_thruplay_watched_actions',
    ]

    const params = new URLSearchParams({
      fields: apiFields.join(','),
      date_preset: datePreset || 'last_7d',
      access_token: this.token,
    })

    if (breakdown && breakdown !== 'none') {
      if (breakdown === 'day') {
        params.set('time_increment', '1')
      } else {
        params.set('breakdowns', breakdown)
      }
    }

    type ActionEntry = { action_type: string; value: string }
    type InsightRow = Record<string, string | ActionEntry[] | undefined>

    const data = await metaGet<{ data?: InsightRow[] }>(`${target}?${params}`)
    const row: InsightRow = data.data?.[0] || {}

    const findAction = (field: ActionEntry[] | undefined, type: string): number =>
      parseFloat(field?.find(a => a.action_type === type)?.value || '0')

    const sumActions = (field: ActionEntry[] | undefined): number =>
      (field || []).reduce((sum, a) => sum + parseFloat(a.value || '0'), 0)

    const actions = row.actions as ActionEntry[] | undefined
    const cpa = row.cost_per_action_type as ActionEntry[] | undefined
    const purchaseRoas = row.purchase_roas as ActionEntry[] | undefined
    const actionValues = row.action_values as ActionEntry[] | undefined
    const thruplayField = row.video_thruplay_watched_actions as ActionEntry[] | undefined

    const impressoes = parseInt(row.impressions as string || '0')
    const gasto = parseFloat(row.spend as string || '0')

    const engajamentos = findAction(actions, 'post_engagement')
    const leads = findAction(actions, 'lead')
    const compras = findAction(actions, 'omni_purchase') || findAction(actions, 'offsite_conversion.fb_pixel_purchase') || findAction(actions, 'purchase')
    const seguidores = findAction(actions, 'like') || findAction(actions, 'follow')
    const conversas = findAction(actions, 'onsite_conversion.messaging_conversation_started_7d')
      || findAction(actions, 'messaging_conversation_started_7d')
    const adicoes = findAction(actions, 'offsite_conversion.fb_pixel_add_to_cart') || findAction(actions, 'add_to_cart')
    const videoViews = findAction(actions, 'video_view')
    const thruplayCount = sumActions(thruplayField) || findAction(actions, 'video_thruplay_watched')

    return {
      impressoes,
      alcance: parseInt(row.reach as string || '0'),
      cliques: parseInt(row.clicks as string || '0'),
      ctr: parseFloat(row.ctr as string || '0'),
      cpc: parseFloat(row.cpc as string || '0'),
      cpm: parseFloat(row.cpm as string || '0'),
      gasto,
      roas: findAction(purchaseRoas, 'omni_purchase') || findAction(purchaseRoas, 'purchase'),
      frequencia: parseFloat(row.frequency as string || '0'),
      engajamentos,
      leads,
      compras,
      seguidores,
      conversas_iniciadas: conversas,
      adicoes_carrinho: adicoes,
      visualizacoes_video: videoViews,
      thruplay: thruplayCount,
      cpe: findAction(cpa, 'post_engagement'),
      cpl: findAction(cpa, 'lead'),
      custo_mensagem: findAction(cpa, 'onsite_conversion.messaging_conversation_started_7d')
        || findAction(cpa, 'messaging_conversation_started_7d'),
      custo_compra: findAction(cpa, 'omni_purchase') || findAction(cpa, 'purchase'),
      custo_seguidor: seguidores > 0 ? gasto / seguidores : 0,
      custo_conversa: findAction(cpa, 'onsite_conversion.messaging_conversation_started_7d')
        || findAction(cpa, 'messaging_conversation_started_7d'),
      custo_adicao: findAction(cpa, 'offsite_conversion.fb_pixel_add_to_cart') || findAction(cpa, 'add_to_cart'),
      custo_thruplay: thruplayCount > 0 ? gasto / thruplayCount : 0,
      cliques_link: parseInt(row.inline_link_clicks as string || '0'),
      hook_rate: impressoes > 0 ? (videoViews / impressoes) * 100 : 0,
      receita: findAction(actionValues, 'omni_purchase') || findAction(actionValues, 'purchase'),
      periodo: datePreset,
    }
  }

  async getMetricsByAd(
    adsetId: string,
    datePreset: string,
    fields: string[]
  ): Promise<Array<MetaMetrics & { id: string; name: string; ad_id: string; ad_name: string; metricas: MetaMetrics }>> {
    const apiFields = [
      'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm', 'spend',
      'purchase_roas', 'frequency', 'inline_link_clicks',
      'actions', 'cost_per_action_type', 'action_values',
      'video_thruplay_watched_actions',
    ]

    const params = new URLSearchParams({
      fields: ['ad_id', 'ad_name', ...apiFields].join(','),
      date_preset: datePreset || 'last_7d',
      level: 'ad',
      access_token: this.token,
    })

    type ActionEntry = { action_type: string; value: string }
    type InsightRow = Record<string, string | ActionEntry[] | undefined>

    // Fetch insights + ad metadata (created_time, status) in parallel
    const [insightsData, adsData] = await Promise.all([
      metaGet<{ data?: InsightRow[] }>(`${META_API}/${adsetId}/insights?${params}`),
      metaGet<{ data?: { id: string; created_time: string; status: string }[] }>(
        `${META_API}/${adsetId}/ads?fields=id,created_time,status&limit=500&access_token=${this.token}`
      ),
    ])

    const rows = insightsData.data || []
    const adsMetadata = adsData.data || []

    // Build lookup: ad_id → metadata
    const adsMeta = new Map(adsMetadata.map(a => [a.id, a]))
    const totalAtivos = adsMetadata.filter(a => a.status === 'ACTIVE').length

    const findAction = (field: ActionEntry[] | undefined, type: string): number =>
      parseFloat(field?.find(a => a.action_type === type)?.value || '0')

    const sumActions = (field: ActionEntry[] | undefined): number =>
      (field || []).reduce((sum, a) => sum + parseFloat(a.value || '0'), 0)

    return rows.map(row => {
      const actions = row.actions as ActionEntry[] | undefined
      const cpa = row.cost_per_action_type as ActionEntry[] | undefined
      const purchaseRoas = row.purchase_roas as ActionEntry[] | undefined
      const actionValues = row.action_values as ActionEntry[] | undefined
      const thruplayField = row.video_thruplay_watched_actions as ActionEntry[] | undefined

      const impressoes = parseInt(row.impressions as string || '0')
      const gasto = parseFloat(row.spend as string || '0')
      const seguidores = findAction(actions, 'like') || findAction(actions, 'follow')
      const videoViews = findAction(actions, 'video_view')
      const thruplayCount = sumActions(thruplayField) || findAction(actions, 'video_thruplay_watched')
      const conversas = findAction(actions, 'onsite_conversion.messaging_conversation_started_7d')
        || findAction(actions, 'messaging_conversation_started_7d')

      const metricas: MetaMetrics = {
        impressoes,
        alcance: parseInt(row.reach as string || '0'),
        cliques: parseInt(row.clicks as string || '0'),
        ctr: parseFloat(row.ctr as string || '0'),
        cpc: parseFloat(row.cpc as string || '0'),
        cpm: parseFloat(row.cpm as string || '0'),
        gasto,
        roas: findAction(purchaseRoas, 'omni_purchase') || findAction(purchaseRoas, 'purchase'),
        frequencia: parseFloat(row.frequency as string || '0'),
        engajamentos: findAction(actions, 'post_engagement'),
        leads: findAction(actions, 'lead'),
        compras: findAction(actions, 'omni_purchase') || findAction(actions, 'offsite_conversion.fb_pixel_purchase') || findAction(actions, 'purchase'),
        seguidores,
        conversas_iniciadas: conversas,
        adicoes_carrinho: findAction(actions, 'offsite_conversion.fb_pixel_add_to_cart') || findAction(actions, 'add_to_cart'),
        visualizacoes_video: videoViews,
        thruplay: thruplayCount,
        cpe: findAction(cpa, 'post_engagement'),
        cpl: findAction(cpa, 'lead'),
        custo_mensagem: findAction(cpa, 'onsite_conversion.messaging_conversation_started_7d') || findAction(cpa, 'messaging_conversation_started_7d'),
        custo_compra: findAction(cpa, 'omni_purchase') || findAction(cpa, 'offsite_conversion.fb_pixel_purchase') || findAction(cpa, 'purchase'),
        custo_seguidor: seguidores > 0 ? gasto / seguidores : 0,
        custo_conversa: findAction(cpa, 'onsite_conversion.messaging_conversation_started_7d') || findAction(cpa, 'messaging_conversation_started_7d'),
        custo_adicao: findAction(cpa, 'offsite_conversion.fb_pixel_add_to_cart') || findAction(cpa, 'add_to_cart'),
        custo_thruplay: thruplayCount > 0 ? gasto / thruplayCount : 0,
        cliques_link: parseInt(row.inline_link_clicks as string || '0'),
        hook_rate: impressoes > 0 ? (videoViews / impressoes) * 100 : 0,
        receita: findAction(actionValues, 'omni_purchase') || findAction(actionValues, 'offsite_conversion.fb_pixel_purchase') || findAction(actionValues, 'purchase'),
        periodo: datePreset,
      }

      const adId = row.ad_id as string || ''
      const meta = adsMeta.get(adId)
      const createdTime = meta?.created_time
      const ageDays = createdTime
        ? Math.floor((Date.now() - new Date(createdTime).getTime()) / 86_400_000)
        : null

      return {
        id: adId,
        name: row.ad_name as string || '',
        // campos extras para compatibilidade com evaluate_campaign_performance
        ad_id: adId,
        ad_name: row.ad_name as string || '',
        created_time: createdTime,
        age_days: ageDays,
        _total_ativos: totalAtivos,
        metricas,
        // métricas também flat para acesso direto via variáveis
        ...metricas,
      }
    })
  }

  async getCreativeInsights(adId?: string): Promise<Record<string, unknown>[]> {
    const target = adId
      ? `${META_API}/${adId}/insights`
      : `${this.accountUrl}/insights`
    const params = new URLSearchParams({
      fields: 'ad_id,ad_name,impressions,reach,clicks,ctr,cpc,cpm,spend,purchase_roas',
      level: 'ad',
      date_preset: 'last_30d',
      access_token: this.token,
    })
    const data = await metaGet<{ data?: Record<string, unknown>[] }>(`${target}?${params}`)
    return data.data || []
  }

  // ─── Boost Post ──────────────────────────────────────────────────────────

  async boostPost(params: {
    post_id: string
    page_id: string
    daily_budget: number
    duration_days: number
    targeting: Record<string, unknown>
    optimization_goal?: string
  }): Promise<{ campaign_id: string; adset_id: string; ad_id: string }> {
    const endTime = new Date()
    endTime.setDate(endTime.getDate() + params.duration_days)

    const campaign = await this.createCampaign({
      name: `Boost - ${params.post_id}`,
      objective: 'POST_ENGAGEMENT',
      status: 'ACTIVE',
      special_ad_categories: [],
    })

    const adSet = await this.createAdSet({
      campaign_id: campaign.id,
      name: `Boost AdSet - ${params.post_id}`,
      optimization_goal: params.optimization_goal || 'POST_ENGAGEMENT',
      billing_event: 'IMPRESSIONS',
      daily_budget: params.daily_budget,
      targeting: params.targeting,
      status: 'ACTIVE',
      end_time: endTime.toISOString(),
    })

    const adBody = {
      adset_id: adSet.id,
      name: `Boost Ad - ${params.post_id}`,
      creative: { object_story_id: `${params.page_id}_${params.post_id}` },
      status: 'ACTIVE',
      access_token: this.token,
    }
    const adData = await metaPost(`${this.accountUrl}/ads`, adBody)

    return { campaign_id: campaign.id, adset_id: adSet.id, ad_id: adData.id as string }
  }

  // ─── Check if Instagram Posts are Already Running as Ads ────────────────

  /**
   * Busca todos os IDs de posts do Instagram que já estão sendo usados em anúncios
   * ativos/pausados/em revisão nesta conta de anúncios.
   *
   * Usa GET /act_{id}/ads?fields=creative{source_instagram_media_id}
   * com filtering por effective_status — endpoint e filtro oficialmente suportados pela Meta API.
   */
  async getSponsoredInstagramPostIds(): Promise<Set<string>> {
    try {
      const params = new URLSearchParams({
        fields: 'creative{source_instagram_media_id}',
        filtering: JSON.stringify([{
          field: 'effective_status',
          operator: 'IN',
          value: ['ACTIVE', 'PAUSED', 'PENDING_REVIEW', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'],
        }]),
        limit: '500',
        access_token: this.token,
      })
      const ads = await metaGetAll<{ creative?: { source_instagram_media_id?: string } }>(
        `${this.accountUrl}/ads?${params}`
      )
      const ids = new Set<string>()
      for (const ad of ads) {
        if (ad.creative?.source_instagram_media_id) {
          ids.add(ad.creative.source_instagram_media_id)
        }
      }
      return ids
    } catch {
      return new Set()
    }
  }

  async isInstagramPostAlreadySponsored(postId: string): Promise<boolean> {
    const ids = await this.getSponsoredInstagramPostIds()
    return ids.has(postId)
  }

  // ─── Create Ad from Existing Instagram Post ──────────────────────────────

  async createAdFromInstagramPost(params: {
    postId: string
    instagramAccountId?: string
    pageId?: string
    adsetId: string
    adName: string
    status?: string
  }): Promise<{ ad_id: string; creative_id: string }> {
    // Meta Marketing API: to use an existing Instagram post as an ad creative,
    // page_id is REQUIRED. instagram_actor_id is optional — Meta infers it from source_instagram_media_id.
    // Using object_story_spec avoids "link required" error that occurs with top-level object_id alone.
    if (!params.pageId) {
      throw new Error('Página do Facebook não configurada. Selecione a página no bloco "Criar anúncio" ou cadastre-a no perfil do cliente.')
    }

    // Use top-level object_id + instagram_user_id (not object_story_spec) — this is the format
    // that Meta accepts for "Use Posts as Instagram Ads" and was confirmed working.
    // object_story_spec with instagram_actor_id causes "must be a valid Instagram account id" errors.
    const creativeBody: Record<string, unknown> = {
      name: `Creative - ${params.adName}`,
      source_instagram_media_id: params.postId,
      object_id: params.pageId,
      access_token: this.token,
    }
    if (params.instagramAccountId) creativeBody.instagram_user_id = params.instagramAccountId
    let creativeId: string
    try {
      const creativeData = await metaPost(`${this.accountUrl}/adcreatives`, creativeBody)
      creativeId = creativeData.id as string
    } catch (err) {
      throw new Error(`[adcreatives] ${err instanceof Error ? err.message : String(err)}`)
    }

    const adBody: Record<string, unknown> = {
      adset_id: params.adsetId,
      name: params.adName,
      creative: { creative_id: creativeId }, // object, not JSON string (Content-Type: application/json)
      status: params.status || 'ACTIVE',
      access_token: this.token,
    }
    try {
      const adData = await metaPost(`${this.accountUrl}/ads`, adBody)
      return { ad_id: adData.id as string, creative_id: creativeId }
    } catch (err) {
      throw new Error(`[ads account=act_${this.adAccountId} adset=${params.adsetId} creative=${creativeId}] ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ─── Instagram Posts ─────────────────────────────────────────────────────

  async getInstagramPosts(
    instagramAccountId: string,
    limit = 20,
    mediaTypeFilter?: string,
    period?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<MetaInstagramPost[]> {
    const nowMs = Date.now()
    let sinceMs: number | undefined
    let untilMs: number | undefined

    // Period presets → milliseconds for client-side timestamp filtering
    // Note: /{ig-user-id}/media does not support since/until as date filters;
    // they are cursor-based pagination params. We filter by timestamp client-side.
    if (period && period !== 'all' && period !== 'custom') {
      untilMs = nowMs
      if (period === '24h') sinceMs = nowMs - 86400_000
      else if (period === '7d') sinceMs = nowMs - 7 * 86400_000
      else if (period === '30d') sinceMs = nowMs - 30 * 86400_000
      else if (period === '90d') sinceMs = nowMs - 90 * 86400_000
      else if (period === 'this_month') {
        const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0)
        sinceMs = d.getTime()
      }
    }
    // custom period or explicit dates
    if (dateFrom) sinceMs = new Date(dateFrom).getTime()
    if (dateTo) untilMs = new Date(dateTo + 'T23:59:59').getTime()

    const hasDateFilter = sinceMs !== undefined || untilMs !== undefined

    // Fetch in batches of 50; stop early once posts are older than sinceMs
    const params = new URLSearchParams({
      fields: 'id,caption,media_type,media_product_type,media_url,permalink,timestamp,like_count,comments_count',
      limit: '50',
      access_token: this.token,
    })

    let posts: MetaInstagramPost[] = []
    let nextUrl: string | null = `${META_API}/${instagramAccountId}/media?${params}`
    const maxFetch = hasDateFilter ? 500 : Math.min(limit * 3, 200)

    while (nextUrl && posts.length < maxFetch) {
      const page: { data?: MetaInstagramPost[]; paging?: { next?: string } } = await metaGet<{ data?: MetaInstagramPost[]; paging?: { next?: string } }>(nextUrl)
      const batch = page.data || []

      for (const p of batch) {
        const postMs = new Date(p.timestamp).getTime()
        // If post is older than our range, stop paginating (feed is chronological desc)
        if (sinceMs !== undefined && postMs < sinceMs) {
          nextUrl = null
          break
        }
        if (untilMs === undefined || postMs <= untilMs) {
          posts.push(p)
        }
      }

      if (nextUrl !== null) nextUrl = page.paging?.next || null
    }

    // Client-side media type filter
    if (mediaTypeFilter && mediaTypeFilter !== 'ALL') {
      if (mediaTypeFilter === 'FEED') {
        // Feed posts: fotos, carrosséis, vídeos de feed e reels
        posts = posts.filter(p =>
          p.media_type === 'IMAGE' ||
          p.media_type === 'CAROUSEL_ALBUM' ||
          p.media_type === 'VIDEO' ||
          p.media_product_type === 'REELS'
        )
      } else if (mediaTypeFilter === 'REELS') {
        posts = posts.filter(p => p.media_product_type === 'REELS' || p.media_type === 'REELS')
      } else if (mediaTypeFilter === 'VIDEO') {
        // Vídeos de feed (não Reels)
        posts = posts.filter(p => p.media_type === 'VIDEO' && p.media_product_type !== 'REELS')
      } else {
        posts = posts.filter(p => p.media_type === mediaTypeFilter)
      }
    }

    return posts.slice(0, limit)
  }

  async getFacebookPages(): Promise<{ id: string; name: string }[]> {
    const data = await metaGet<{ data?: { id: string; name: string }[] }>(
      `${META_API}/me/accounts?fields=id,name&limit=200&access_token=${this.token}`
    )
    return data.data || []
  }

  async getInstagramAccounts(adAccountIds: string[] = []): Promise<MetaInstagramAccount[]> {
    const seen = new Set<string>()
    const accounts: MetaInstagramAccount[] = []

    const add = (acc: MetaInstagramAccount) => {
      if (!seen.has(acc.id)) { seen.add(acc.id); accounts.push(acc) }
    }

    // Tentativa 1: via Páginas do Facebook linkadas ao token
    try {
      const pages = await metaGetAll<{ instagram_business_account?: MetaInstagramAccount }>(
        `${META_API}/me/accounts?fields=id,name,instagram_business_account{id,name,username}&limit=200&access_token=${this.token}`
      )
      for (const page of pages) {
        if (page.instagram_business_account) add(page.instagram_business_account)
      }
    } catch { /* sem páginas */ }

    // Tentativa 2: via Business Managers (requer business_management)
    try {
      const bms = await metaGetAll<{ id: string }>(
        `${META_API}/me/businesses?fields=id&limit=200&access_token=${this.token}`
      )

      const fetchIgFromBusiness = async (bizId: string) => {
        await Promise.allSettled([
          metaGetAll<MetaInstagramAccount>(
            `${META_API}/${bizId}/owned_instagram_accounts?fields=id,name,username&limit=200&access_token=${this.token}`
          ).then(list => list.forEach(add)),
          metaGetAll<MetaInstagramAccount>(
            `${META_API}/${bizId}/instagram_accounts?fields=id,name,username&limit=200&access_token=${this.token}`
          ).then(list => list.forEach(add)),
          // Páginas do negócio com Instagram vinculado
          metaGetAll<{ instagram_business_account?: MetaInstagramAccount }>(
            `${META_API}/${bizId}/owned_pages?fields=id,instagram_business_account{id,name,username}&limit=200&access_token=${this.token}`
          ).then(pages => pages.forEach(p => p.instagram_business_account && add(p.instagram_business_account))),
          metaGetAll<{ instagram_business_account?: MetaInstagramAccount }>(
            `${META_API}/${bizId}/client_pages?fields=id,instagram_business_account{id,name,username}&limit=200&access_token=${this.token}`
          ).then(pages => pages.forEach(p => p.instagram_business_account && add(p.instagram_business_account))),
        ])
      }

      for (const bm of bms) {
        // Busca IGs direto no BM
        await fetchIgFromBusiness(bm.id)

        // Busca nos sub-negócios (owned_businesses) do BM — ex: "Toca do Caboclo" dentro do BM principal
        try {
          const subBizList = await metaGetAll<{ id: string }>(
            `${META_API}/${bm.id}/owned_businesses?fields=id&limit=200&access_token=${this.token}`
          )
          await Promise.allSettled(subBizList.map(sub => fetchIgFromBusiness(sub.id)))
        } catch { /* sem sub-negócios ou sem permissão */ }

        // Busca nos negócios clientes do BM
        try {
          const clientBizList = await metaGetAll<{ id: string }>(
            `${META_API}/${bm.id}/client_businesses?fields=id&limit=200&access_token=${this.token}`
          )
          await Promise.allSettled(clientBizList.map(sub => fetchIgFromBusiness(sub.id)))
        } catch { /* sem clientes ou sem permissão */ }
      }
    } catch { /* sem BMs ou sem permissão */ }

    // Tentativa 3: via cada conta de anúncios (requer apenas ads_management)
    if (adAccountIds.length > 0) {
      const chunks: string[][] = []
      for (let i = 0; i < adAccountIds.length; i += 10) chunks.push(adAccountIds.slice(i, i + 10))
      for (const chunk of chunks) {
        await Promise.allSettled(
          chunk.map(rawId => {
            const actId = rawId.startsWith('act_') ? rawId : `act_${rawId}`
            return metaGetAll<MetaInstagramAccount>(
              `${META_API}/${actId}/instagram_accounts?fields=id,name,username&limit=200&access_token=${this.token}`
            ).then(list => list.forEach(add))
          })
        )
      }
    }

    // Tentativa 4: endpoint direto do usuário
    try {
      const direct = await metaGetAll<MetaInstagramAccount>(
        `${META_API}/me/instagram_accounts?fields=id,name,username&limit=200&access_token=${this.token}`
      )
      direct.forEach(add)
    } catch { /* sem permissão */ }

    // Tentativa 5: contas atribuídas ao usuário como employee em qualquer BM
    // (/{bm_id}/instagram_accounts só retorna tudo para admins;
    //  para employees, somente as contas assignadas aparecem aqui)
    try {
      const assigned = await metaGetAll<MetaInstagramAccount>(
        `${META_API}/me/assigned_instagram_accounts?fields=id,name,username&limit=200&access_token=${this.token}`
      )
      assigned.forEach(add)
    } catch { /* sem permissão */ }

    return accounts
  }

  // ─── Audiences ───────────────────────────────────────────────────────────

  async getAudiences(): Promise<MetaAudience[]> {
    const params = new URLSearchParams({
      fields: 'id,name,subtype,approximate_count,description',
      access_token: this.token,
    })
    const data = await metaGet<{ data?: MetaAudience[] }>(`${this.accountUrl}/customaudiences?${params}`)
    return data.data || []
  }

  async createCustomAudience(params: {
    name: string
    description?: string
    subtype: 'CUSTOM' | 'WEBSITE' | 'APP' | 'LOOKALIKE'
    pixel_id?: string
    rule?: Record<string, unknown>
    lookalike_spec?: Record<string, unknown>
  }): Promise<{ id: string; name: string }> {
    const body: Record<string, unknown> = {
      name: params.name,
      subtype: params.subtype,
      access_token: this.token,
    }
    if (params.description) body.description = params.description
    if (params.pixel_id) body.pixel_id = params.pixel_id
    if (params.rule) body.rule = params.rule
    if (params.lookalike_spec) body.lookalike_spec = params.lookalike_spec
    const data = await metaPost(`${this.accountUrl}/customaudiences`, body)
    return { id: data.id as string, name: params.name }
  }

  // ─── Creative Upload ─────────────────────────────────────────────────────

  async uploadAdImage(bytes: Buffer): Promise<{ hash: string }> {
    const base64 = bytes.toString('base64')
    const res = await metaPost(`${this.accountUrl}/adimages`, {
      bytes: base64,
      access_token: this.token,
    })
    const images = (res as { images?: Record<string, { hash: string }> }).images
    const first = images ? Object.values(images)[0] : null
    if (!first?.hash) throw new Error('Erro ao fazer upload de imagem para Meta: hash não retornado')
    return { hash: first.hash }
  }

  async uploadAdVideo(bytes: Buffer, name: string, mimeType: string): Promise<{ video_id: string; thumbnail_hash: string | null }> {
    const form = new FormData()
    form.append('access_token', this.token)
    form.append('title', name)
    form.append('source', new Blob([new Uint8Array(bytes)], { type: mimeType }), name)
    const res = await fetch(`https://graph-video.facebook.com/v21.0/act_${this.adAccountId}/advideos`, {
      method: 'POST',
      body: form,
    })
    const data = await res.json() as { id?: string; error?: { message?: string } }
    if (data.error?.message) throw new Error(`Erro ao fazer upload de vídeo para Meta: ${data.error.message}`)
    if (!data.id) throw new Error('Erro ao fazer upload de vídeo para Meta: id não retornado')

    // Aguarda o vídeo ser processado antes de retornar (até 3 min)
    await this.waitForVideoReady(data.id)

    // Busca thumbnail, faz upload como imagem e retorna o hash (obrigatório para creative de vídeo)
    const thumbnail_hash = await this.uploadVideoThumbnailAsImage(data.id)

    return { video_id: data.id, thumbnail_hash }
  }

  private async uploadVideoThumbnailAsImage(videoId: string): Promise<string | null> {
    try {
      // Busca URL do thumbnail gerado pela Meta
      const thumbRes = await fetch(`${META_API}/${videoId}/thumbnails?access_token=${this.token}`)
      if (!thumbRes.ok) return null
      const thumbData = await thumbRes.json() as { data?: Array<{ uri: string; is_preferred?: boolean }> }
      const thumbs = thumbData.data || []
      const preferred = thumbs.find((t) => t.is_preferred) || thumbs[0]
      if (!preferred?.uri) return null

      // Baixa os bytes do thumbnail
      const imgRes = await fetch(preferred.uri, { signal: AbortSignal.timeout(30_000) })
      if (!imgRes.ok) return null
      const imgBytes = Buffer.from(await imgRes.arrayBuffer())

      // Faz upload como ad image para obter image_hash
      const result = await this.uploadAdImage(imgBytes)
      return result.hash
    } catch {
      return null
    }
  }

  private async waitForVideoReady(videoId: string, maxWaitMs = 180_000): Promise<void> {
    const interval = 5_000
    const deadline = Date.now() + maxWaitMs
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval))
      const url = `${META_API}/${videoId}?fields=status&access_token=${this.token}`
      const res = await fetch(url)
      if (!res.ok) continue
      const d = await res.json() as { status?: { video_status?: string; processing_progress?: number } }
      const status = d.status?.video_status
      console.log(`[Meta] Vídeo ${videoId} status: ${status} (${d.status?.processing_progress ?? '?'}%)`)
      if (status === 'ready') return
      if (status === 'error') throw new Error(`Vídeo ${videoId} falhou ao processar na Meta`)
    }
    throw new Error(`Timeout aguardando processamento do vídeo ${videoId} na Meta (máx ${maxWaitMs / 1000}s)`)
  }

  // ─── Legacy compat ───────────────────────────────────────────────────────

  /** @deprecated use pauseObject */
  async pauseAd(adId: string): Promise<void> { return this.pauseObject(adId) }
  /** @deprecated use activateObject */
  async activateAd(adId: string): Promise<void> { return this.activateObject(adId) }
}
