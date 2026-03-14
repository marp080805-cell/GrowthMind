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
}

export interface MetaMetrics {
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
  spend: number
  roas?: number
}

export class MetaService {
  constructor(private token: string, private adAccountId: string) {
    // Normalize: strip leading 'act_' to avoid act_act_ duplication
    this.adAccountId = adAccountId.replace(/^act_/, '')
  }

  async validateToken(): Promise<{ valid: boolean; accounts: MetaAccount[] }> {
    const res = await fetch(
      `${META_API}/me/adaccounts?fields=id,name,currency&access_token=${this.token}`
    )
    if (!res.ok) throw new Error('Token Meta inválido')
    const data = await res.json() as { data?: MetaAccount[] }
    return {
      valid: true,
      accounts: data.data || [],
    }
  }

  async getCampaigns(): Promise<MetaCampaign[]> {
    const res = await fetch(
      `${META_API}/act_${this.adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&access_token=${this.token}`
    )
    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } }
      throw new Error(err.error?.message || 'Erro ao buscar campanhas')
    }
    const data = await res.json() as { data?: MetaCampaign[] }
    return data.data || []
  }

  async getMetrics(
    campaignId: string | null,
    datePreset: string,
    fields: string[],
    breakdown?: string
  ): Promise<MetaMetrics & { period: string }> {
    const target = campaignId
      ? `${META_API}/${campaignId}/insights`
      : `${META_API}/act_${this.adAccountId}/insights`

    const defaultFields = ['impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm', 'spend']
    const requestedFields = fields.length > 0 ? fields : defaultFields

    const params = new URLSearchParams({
      fields: requestedFields.join(','),
      date_preset: datePreset || 'last_7d',
      access_token: this.token,
    })

    if (breakdown && breakdown !== 'none') {
      params.set('breakdown', breakdown)
    }

    const res = await fetch(`${target}?${params}`)
    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } }
      throw new Error(err.error?.message || 'Erro ao buscar métricas')
    }

    const data = await res.json() as { data?: Record<string, string>[] }
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
    } as unknown as MetaMetrics & { period: string }
  }

  async pauseAd(adId: string): Promise<void> {
    const res = await fetch(`${META_API}/${adId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED', access_token: this.token }),
    })
    if (!res.ok) throw new Error('Erro ao pausar anúncio')
  }

  async activateAd(adId: string): Promise<void> {
    const res = await fetch(`${META_API}/${adId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE', access_token: this.token }),
    })
    if (!res.ok) throw new Error('Erro ao ativar anúncio')
  }

  async updateBudget(campaignId: string, dailyBudget: number): Promise<void> {
    const res = await fetch(`${META_API}/${campaignId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        daily_budget: Math.round(dailyBudget * 100),
        access_token: this.token,
      }),
    })
    if (!res.ok) throw new Error('Erro ao ajustar orçamento')
  }
}
