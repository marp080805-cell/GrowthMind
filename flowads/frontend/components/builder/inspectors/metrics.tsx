'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { campaignsApi, adsetsApi, type Campaign, type AdSet } from '@/lib/api'
import type { InspectorFieldProps } from '../inspector'

const ALL_METRICS = [
  // Resultado
  { key: 'engajamentos',   label: 'Engajamentos',   group: 'Resultado' },
  { key: 'leads',          label: 'Leads',           group: 'Resultado' },
  // Custo por resultado
  { key: 'cpe',            label: 'Custo/Engajamento', group: 'Custo p/ resultado' },
  { key: 'cpl',            label: 'Custo/Lead',      group: 'Custo p/ resultado' },
  { key: 'custo_mensagem', label: 'Custo/Mensagem',  group: 'Custo p/ resultado' },
  // Qualidade
  { key: 'ctr',            label: 'CTR',             group: 'Qualidade' },
  { key: 'cliques_link',   label: 'Cliques no link', group: 'Qualidade' },
  { key: 'cliques',        label: 'Cliques totais',  group: 'Qualidade' },
  // Saturação
  { key: 'frequencia',     label: 'Frequência',      group: 'Saturação' },
  // Distribuição
  { key: 'cpm',            label: 'CPM',             group: 'Distribuição' },
  { key: 'cpc',            label: 'CPC',             group: 'Distribuição' },
  { key: 'impressoes',     label: 'Impressões',      group: 'Distribuição' },
  { key: 'alcance',        label: 'Alcance',         group: 'Distribuição' },
  // Financeiro
  { key: 'gasto',          label: 'Gasto',           group: 'Financeiro' },
  { key: 'roas',           label: 'ROAS',            group: 'Financeiro' },
]

const DEFAULT_SELECTED = ALL_METRICS.map(m => m.key)

export function MetricsInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const params = useParams<{ id?: string }>()
  const clientId = params?.id

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adsets, setAdsets] = useState<AdSet[]>([])
  const [loadingAdsets, setLoadingAdsets] = useState(false)
  // fully controlled — no local state so value survives close/reopen
  const campaignForAdsets = (config.campaign_id as string) || ''
  const setCampaignForAdsets = (val: string) => onChange({ ...config, campaign_id: val, object_id: '' })

  const level = (config.level as string) || 'account'
  const selectedMetrics = (config.metrics as string[]) || DEFAULT_SELECTED

  useEffect(() => {
    if (clientId) campaignsApi.list(clientId).then(setCampaigns).catch(() => {})
  }, [clientId])

  useEffect(() => {
    if (clientId && level === 'adset' && campaignForAdsets) {
      setLoadingAdsets(true)
      setAdsets([])
      adsetsApi.list(clientId, campaignForAdsets)
        .then(setAdsets).catch(() => {}).finally(() => setLoadingAdsets(false))
    } else {
      setAdsets([])
    }
  }, [clientId, level, campaignForAdsets])

  const toggleMetric = (key: string) => {
    onChange({
      ...config,
      metrics: selectedMetrics.includes(key)
        ? selectedMetrics.filter(m => m !== key)
        : [...selectedMetrics, key],
    })
  }

  const sel = "h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent w-full"

  return (
    <>
      {/* Nível + Status */}
      <div className="flex gap-2">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-syne font-semibold text-text3">NÍVEL</label>
          <select
            value={level}
            onChange={e => onChange({ ...config, level: e.target.value, object_id: '' })}
            className={sel}
          >
            <option value="account">Conta inteira</option>
            <option value="campaign">Por campanha</option>
            <option value="adset">Por conjunto</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-syne font-semibold text-text3">STATUS</label>
          <select
            value={(config.status_filter as string) || 'ACTIVE'}
            onChange={e => set('status_filter', e.target.value)}
            className={sel}
          >
            <option value="ACTIVE">Ativos</option>
            <option value="PAUSED">Pausados</option>
            <option value="ALL">Todos</option>
          </select>
        </div>
      </div>

      {/* Campanha (level = campaign) */}
      {level === 'campaign' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">CAMPANHA</label>
          <select
            value={(config.object_id as string) || ''}
            onChange={e => set('object_id', e.target.value)}
            className={sel}
          >
            <option value="">Todas as campanhas</option>
            {campaigns.map(c => (
              <option key={c.meta_campaign_id} value={c.meta_campaign_id}>
                {c.name} {c.status !== 'ACTIVE' ? `(${c.status})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Adset (level = adset) */}
      {level === 'adset' && (
        <>
          {campaigns.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-syne font-semibold text-text3">CAMPANHA (para carregar conjuntos)</label>
              <select
                value={campaignForAdsets}
                onChange={e => setCampaignForAdsets(e.target.value)}
                className={sel}
              >
                <option value="">Selecione para listar conjuntos...</option>
                {campaigns.map(c => (
                  <option key={c.meta_campaign_id} value={c.meta_campaign_id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">CONJUNTO DE ANÚNCIOS</label>
            {loadingAdsets ? (
              <div className="text-[10px] text-text3 py-1">Carregando...</div>
            ) : (
              <select
                value={(config.object_id as string) || ''}
                onChange={e => set('object_id', e.target.value)}
                className={sel}
              >
                <option value="">Selecione o conjunto...</option>
                {adsets.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
          </div>
        </>
      )}

      {/* Período */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">PERÍODO</label>
        <select
          value={(config.period as string) || '7d'}
          onChange={e => set('period', e.target.value)}
          className={sel}
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="14d">Últimos 14 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="this_month">Mês atual</option>
        </select>
      </div>

      {/* Métricas */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-syne font-semibold text-text3">MÉTRICAS</label>
          <button
            onClick={() => onChange({ ...config, metrics: DEFAULT_SELECTED })}
            className="text-[10px] text-accent hover:text-accent/70 transition-colors"
          >
            Todas
          </button>
        </div>
        {Array.from(new Set(ALL_METRICS.map(m => m.group))).map(group => (
          <div key={group} className="space-y-1">
            <p className="text-[9px] font-syne font-semibold text-text3/60 uppercase tracking-wider">{group}</p>
            <div className="flex flex-wrap gap-1">
              {ALL_METRICS.filter(m => m.group === group).map(m => {
                const selected = selectedMetrics.includes(m.key)
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMetric(m.key)}
                    className={`px-2 py-1 rounded-[6px] text-[10px] font-syne font-bold transition-colors border ${
                      selected
                        ? 'bg-accent/10 text-accent border-accent/30'
                        : 'bg-surface text-text3 border-[var(--border)] hover:border-[var(--border2)]'
                    }`}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">BREAKDOWN</label>
        <select
          value={(config.breakdown as string) || 'none'}
          onChange={e => set('breakdown', e.target.value)}
          className={sel}
        >
          <option value="none">Nenhum</option>
          <option value="day">Por dia</option>
          <option value="age">Por faixa etária</option>
          <option value="gender">Por gênero</option>
          <option value="country">Por país</option>
          <option value="publisher_platform">Por plataforma</option>
          <option value="device_platform">Por dispositivo</option>
        </select>
      </div>
    </>
  )
}
