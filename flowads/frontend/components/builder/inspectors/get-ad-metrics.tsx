'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { campaignsApi, adsetsApi, type Campaign, type AdSet } from '@/lib/api'
import type { InspectorFieldProps } from '../inspector'
import { VariableAutocomplete } from '../variable-autocomplete'

export function GetAdMetricsInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const params = useParams<{ id?: string }>()
  const clientId = params?.id

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adsets, setAdsets] = useState<AdSet[]>([])
  const [loadingAdsets, setLoadingAdsets] = useState(false)
  // campaign_id is persisted in config so it survives close/reopen
  const [campaignForAdsets, setCampaignForAdsets] = useState((config.campaign_id as string) || '')

  const source = (config.source as string) || 'fetch'
  const level = (config.level as string) || 'account'

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

  const sel = "h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent w-full"

  return (
    <>
      {/* Fonte dos anúncios */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">FONTE DOS ANÚNCIOS</label>
        <div className="flex gap-1.5">
          {[
            { key: 'fetch', label: 'Buscar agora' },
            { key: 'input', label: 'Node anterior' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => set('source', opt.key)}
              className={`flex-1 h-8 rounded-[8px] text-xs font-syne font-semibold border transition-all ${
                source === opt.key ? 'bg-accent text-white border-accent' : 'bg-bg2 text-text3 border-[var(--border)] hover:border-accent/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {source === 'input' ? (
        /* Node anterior */
        <div className="bg-bg3 rounded-[8px] border border-[var(--border)] px-2.5 py-2 text-[10px] text-text3">
          Lê <code className="text-text2 font-mono">{'{{anuncios}}'}</code> do node "Buscar anúncios" conectado antes.
        </div>
      ) : (
        /* Buscar agora — mostrar seletores */
        <>
          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] font-syne font-semibold text-text3">NÍVEL</label>
              <select
                value={level}
                onChange={(e) => onChange({ ...config, level: e.target.value, parent_id: '' })}
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
                onChange={(e) => set('status_filter', e.target.value)}
                className={sel}
              >
                <option value="ACTIVE">Ativos</option>
                <option value="PAUSED">Pausados</option>
                <option value="ALL">Todos</option>
              </select>
            </div>
          </div>

          {level === 'campaign' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-syne font-semibold text-text3">CAMPANHA</label>
              {campaigns.length > 0 ? (
                <select
                  value={(config.parent_id as string) || ''}
                  onChange={(e) => set('parent_id', e.target.value)}
                  className={sel}
                >
                  <option value="">Selecione a campanha...</option>
                  {campaigns.map(c => (
                    <option key={c.meta_campaign_id} value={c.meta_campaign_id}>
                      {c.name} {c.status !== 'ACTIVE' ? `(${c.status})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <VariableAutocomplete
                  value={(config.parent_id as string) || ''}
                  onChange={(v) => set('parent_id', v)}
                  placeholder="{{campaign_id}} ou ID"
                  rows={1}
                />
              )}
            </div>
          )}

          {level === 'adset' && (
            <>
              {campaigns.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-syne font-semibold text-text3">CAMPANHA (para carregar conjuntos)</label>
                  <select
                    value={campaignForAdsets}
                    onChange={(e) => {
                      setCampaignForAdsets(e.target.value)
                      onChange({ ...config, campaign_id: e.target.value, parent_id: '' })
                    }}
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
                ) : adsets.length > 0 ? (
                  <select
                    value={(config.parent_id as string) || ''}
                    onChange={(e) => set('parent_id', e.target.value)}
                    className={sel}
                  >
                    <option value="">Selecione o conjunto...</option>
                    {adsets.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                ) : (
                  <VariableAutocomplete
                    value={(config.parent_id as string) || ''}
                    onChange={(v) => set('parent_id', v)}
                    placeholder="{{adset_id}} ou ID"
                    rows={1}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Período */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">PERÍODO DE ANÁLISE</label>
        <select
          value={(config.period as string) || '7d'}
          onChange={(e) => set('period', e.target.value)}
          className={sel}
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="14d">Últimos 14 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída</p>
        <p><code className="text-accent">{'{{anuncios}}'}</code> — array com métricas em cada item</p>
        <p className="mt-1 text-text3/80"><code className="text-text2">ctr, cpc, cpm, roas, frequencia, gasto, age_days</code></p>
      </div>
    </>
  )
}
