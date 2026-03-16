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
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json() as Record<string, unknown> & { error?: { message?: string } }
  if (!res.ok || data.error) throw new Error((data.error as { message?: string })?.message || 'Erro na API do Meta')
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
    if (newName) body.rename_options = JSON.stringify({ rename_strategy: 'CUSTOM_RENAME', rename_prefix: newName })
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
      targeting: JSON.stringify(params.targeting),
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
    if (params.targeting) body.targeting = JSON.stringify(params.targeting)
    if (params.end_time) body.end_time = params.end_time
    await metaPost(`${META_API}/${adSetId}`, body)
  }

  // ─── Ads ─────────────────────────────────────────────────────────────────

  async getAds(parentId?: string, parentType: 'campaign' | 'adset' | 'account' = 'account'): Promise<MetaAd[]> {
    const url = parentType === 'account'
      ? `${this.accountUrl}/ads`
      : `${META_API}/${parentId}/ads`
    const params = new URLSearchParams({
      fields: 'id,name,status,adset_id,campaign_id,creative{id}',
      access_token: this.token,
    })
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
    video_id?: string
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
        if (params.image_url) linkData.picture = params.image_url
        if (params.call_to_action) linkData.call_to_action = { type: params.call_to_action }

        if (params.video_id) {
          objectStorySpec.page_id = params.page_id
          objectStorySpec.video_data = {
            video_id: params.video_id,
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
        object_story_spec: JSON.stringify(objectStorySpec),
        access_token: this.token,
      }
      const creativeData = await metaPost(`${this.accountUrl}/adcreatives`, creativeBody)
      creativeId = creativeData.id as string
    }

    const adBody = {
      adset_id: params.adset_id,
      name: params.name,
      creative: JSON.stringify({ creative_id: creativeId }),
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
    if (params.creative_id) body.creative = JSON.stringify({ creative_id: params.creative_id })
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

    const defaultFields = ['impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm', 'spend', 'purchase_roas']
    const requestedFields = fields.length > 0 ? fields : defaultFields

    const params = new URLSearchParams({
      fields: requestedFields.join(','),
      date_preset: datePreset || 'last_7d',
      access_token: this.token,
    })

    if (breakdown && breakdown !== 'none') params.set('breakdowns', breakdown)

    const data = await metaGet<{ data?: Record<string, string>[] }>(`${target}?${params}`)
    const row = data.data?.[0] || {}

    return {
      impressoes: parseInt(row.impressions || '0'),
      alcance: parseInt(row.reach || '0'),
      cliques: parseInt(row.clicks || '0'),
      ctr: parseFloat(row.ctr || '0'),
      cpc: parseFloat(row.cpc || '0'),
      cpm: parseFloat(row.cpm || '0'),
      gasto: parseFloat(row.spend || '0'),
      roas: parseFloat(row.purchase_roas?.[0] || '0'),
      periodo: datePreset,
    }
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
      creative: JSON.stringify({
        object_story_id: `${params.page_id}_${params.post_id}`,
      }),
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
    instagramAccountId: string
    adsetId: string
    adName: string
    status?: string
  }): Promise<{ ad_id: string; creative_id: string }> {
    const creativeBody = {
      name: `Creative - ${params.adName}`,
      object_story_spec: {
        instagram_actor_id: params.instagramAccountId,
        link_data: { source_media_id: params.postId },
      },
      access_token: this.token,
    }
    const creativeData = await metaPost(`${this.accountUrl}/adcreatives`, creativeBody)
    const creativeId = creativeData.id as string

    const adBody = {
      adset_id: params.adsetId,
      name: params.adName,
      creative: { creative_id: creativeId },
      status: params.status || 'ACTIVE',
      access_token: this.token,
    }
    const adData = await metaPost(`${this.accountUrl}/ads`, adBody)

    return { ad_id: adData.id as string, creative_id: creativeId }
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
    if (period && period !== 'all') {
      untilMs = nowMs
      if (period === '24h') sinceMs = nowMs - 86400_000
      else if (period === '7d') sinceMs = nowMs - 7 * 86400_000
      else if (period === '30d') sinceMs = nowMs - 30 * 86400_000
      else if (period === '90d') sinceMs = nowMs - 90 * 86400_000
      else if (period === 'this_month') {
        const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0)
        sinceMs = d.getTime()
      }
    } else if (dateFrom || dateTo) {
      if (dateFrom) sinceMs = new Date(dateFrom).getTime()
      if (dateTo) untilMs = new Date(dateTo + 'T23:59:59').getTime()
    }

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
        posts = posts.filter(p => p.media_type === 'IMAGE' || p.media_type === 'CAROUSEL_ALBUM')
      } else if (mediaTypeFilter === 'REELS') {
        posts = posts.filter(p => p.media_product_type === 'REELS')
      } else {
        posts = posts.filter(p => p.media_type === mediaTypeFilter)
      }
    }

    return posts.slice(0, limit)
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
    if (params.rule) body.rule = JSON.stringify(params.rule)
    if (params.lookalike_spec) body.lookalike_spec = JSON.stringify(params.lookalike_spec)
    const data = await metaPost(`${this.accountUrl}/customaudiences`, body)
    return { id: data.id as string, name: params.name }
  }

  // ─── Legacy compat ───────────────────────────────────────────────────────

  /** @deprecated use pauseObject */
  async pauseAd(adId: string): Promise<void> { return this.pauseObject(adId) }
  /** @deprecated use activateObject */
  async activateAd(adId: string): Promise<void> { return this.activateObject(adId) }
}
