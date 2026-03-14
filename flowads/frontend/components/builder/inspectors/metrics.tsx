'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { campaignsApi, type Campaign } from '@/lib/api'
import type { InspectorFieldProps } from '../inspector'

const METRICS = [
  { key: 'impressoes', label: 'Impressões' },
  { key: 'alcance', label: 'Alcance' },
  { key: 'cliques', label: 'Cliques' },
  { key: 'ctr', label: 'CTR' },
  { key: 'cpc', label: 'CPC' },
  { key: 'cpm', label: 'CPM' },
  { key: 'gasto', label: 'Gasto' },
  { key: 'roas', label: 'ROAS' },
]

export function MetricsInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const selectedMetrics = (config.metrics as string[]) || METRICS.map((m) => m.key)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  const params = useParams<{ id?: string }>()
  const clientId = params?.id

  useEffect(() => {
    if (clientId && (config.campaign as string) === 'specific') {
      campaignsApi.list(clientId).then(setCampaigns).catch(() => {})
    }
  }, [clientId, config.campaign])

  const toggleMetric = (key: string) => {
    onChange({
      ...config,
      metrics: selectedMetrics.includes(key)
        ? selectedMetrics.filter((m) => m !== key)
        : [...selectedMetrics, key],
    })
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">CAMPANHA</label>
        <select
          value={(config.campaign as string) || 'all'}
          onChange={(e) => {
            const val = e.target.value
            if (val === 'all') {
              onChange({ ...config, campaign: 'all', object_id: undefined })
            } else {
              onChange({ ...config, campaign: 'specific', object_id: undefined })
            }
          }}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="all">Todas as campanhas</option>
          <option value="specific">Campanha específica</option>
        </select>
      </div>

      {(config.campaign as string) === 'specific' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">SELECIONAR CAMPANHA</label>
          {campaigns.length > 0 ? (
            <select
              value={(config.object_id as string) || ''}
              onChange={(e) => set('object_id', e.target.value)}
              className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
            >
              <option value="">Selecione a campanha...</option>
              {campaigns.map((c) => (
                <option key={c.meta_campaign_id} value={c.meta_campaign_id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="ID da campanha (ex: 123456789)"
              value={(config.object_id as string) || ''}
              onChange={(e) => set('object_id', e.target.value)}
              className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
            />
          )}
          {!campaigns.length && (
            <p className="text-[10px] text-text3">
              Sincronize campanhas na aba do cliente para selecionar pelo nome.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">PERÍODO</label>
        <select
          value={(config.period as string) || '7d'}
          onChange={(e) => set('period', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="14d">Últimos 14 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="this_month">Mês atual</option>
          <option value="custom">Personalizado</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">MÉTRICAS</label>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => {
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

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">BREAKDOWN</label>
        <select
          value={(config.breakdown as string) || 'none'}
          onChange={(e) => set('breakdown', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="none">Nenhum</option>
          <option value="day">Por dia</option>
          <option value="adset">Por adset</option>
          <option value="creative">Por criativo</option>
        </select>
      </div>
    </>
  )
}
