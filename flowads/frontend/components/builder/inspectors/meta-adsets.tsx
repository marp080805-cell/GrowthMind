'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'
import { campaignsApi, type Campaign } from '@/lib/api'

const OPTIMIZATION_GOALS = [
  'REACH', 'IMPRESSIONS', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS',
  'POST_ENGAGEMENT', 'VIDEO_VIEWS', 'LEAD_GENERATION', 'CONVERSIONS',
  'APP_INSTALLS', 'OFFSITE_CONVERSIONS', 'VALUE',
]

const BILLING_EVENTS = [
  { value: 'IMPRESSIONS', label: 'Impressões' },
  { value: 'LINK_CLICKS', label: 'Cliques no link' },
  { value: 'POST_ENGAGEMENT', label: 'Engajamento no post' },
  { value: 'APP_INSTALLS', label: 'Instalações de app' },
]

export function FetchAdSetsInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DA CAMPANHA (opcional)</label>
        <VariableAutocomplete
          value={(config.campaign_id as string) || ''}
          onChange={(v) => set('campaign_id', v)}
          placeholder="{{campaign_id}} — deixe vazio para todos"
          rows={1}
        />
      </div>
      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{adsets}}'}</code> — array de adsets</p>
        <p><code className="text-accent">{'{{total}}'}</code> — total de adsets</p>
      </div>
    </>
  )
}

export function CreateAdSetInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const params = useParams<{ id?: string }>()
  const clientId = params?.id
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const selectedCampaignId = (config.campaign_id as string) || ''

  useEffect(() => {
    if (clientId) {
      campaignsApi.list(clientId).then(setCampaigns).catch(() => {})
    }
  }, [clientId])

  const selectClass = "h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
  const inputClass = "h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent w-full"

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">CAMPANHA *</label>
        {campaigns.length > 0 ? (
          <select
            value={selectedCampaignId}
            onChange={(e) => set('campaign_id', e.target.value)}
            className={selectClass}
          >
            <option value="">Selecione a campanha...</option>
            {campaigns.map((c) => (
              <option key={c.meta_campaign_id} value={c.meta_campaign_id}>
                {c.name} {c.status !== 'ACTIVE' ? `(${c.status})` : ''}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder="{{campaign_id}} ou ID da campanha"
            value={selectedCampaignId}
            onChange={(e) => set('campaign_id', e.target.value)}
            className={inputClass}
          />
        )}
        {!campaigns.length && (
          <p className="text-[10px] text-text3">Sincronize campanhas na aba do cliente para selecionar pelo nome.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOME DO ADSET *</label>
        <VariableAutocomplete
          value={(config.name as string) || ''}
          onChange={(v) => set('name', v)}
          placeholder="Adset Brasil - {{hoje}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">OBJETIVO DE OTIMIZAÇÃO</label>
        <select
          value={(config.optimization_goal as string) || 'REACH'}
          onChange={(e) => set('optimization_goal', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          {OPTIMIZATION_GOALS.map((g) => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">EVENTO DE COBRANÇA</label>
        <select
          value={(config.billing_event as string) || 'IMPRESSIONS'}
          onChange={(e) => set('billing_event', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          {BILLING_EVENTS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ORÇAMENTO DIÁRIO (R$)</label>
        <VariableAutocomplete
          value={(config.daily_budget as string) || ''}
          onChange={(v) => set('daily_budget', v)}
          placeholder="30 ou {{budget}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">SEGMENTAÇÃO (JSON)</label>
        <VariableAutocomplete
          value={typeof config.targeting === 'object' ? JSON.stringify(config.targeting, null, 2) : (config.targeting as string) || '{\n  "geo_locations": {"countries": ["BR"]},\n  "age_min": 18,\n  "age_max": 65\n}'}
          onChange={(v) => set('targeting', v)}
          rows={5}
          className="font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">STATUS INICIAL</label>
        <select
          value={(config.status as string) || 'PAUSED'}
          onChange={(e) => set('status', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="PAUSED">Pausado</option>
          <option value="ACTIVE">Ativo</option>
        </select>
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{adset_id}}'}</code> — ID do adset criado</p>
      </div>
    </>
  )
}

export function EditAdSetInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO ADSET *</label>
        <VariableAutocomplete
          value={(config.adset_id as string) || ''}
          onChange={(v) => set('adset_id', v)}
          placeholder="{{adset_id}} ou 123456789"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOVO NOME (opcional)</label>
        <VariableAutocomplete
          value={(config.name as string) || ''}
          onChange={(v) => set('name', v)}
          placeholder="Novo nome"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">STATUS</label>
        <select
          value={(config.status as string) || ''}
          onChange={(e) => set('status', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="">Não alterar</option>
          <option value="ACTIVE">Ativar</option>
          <option value="PAUSED">Pausar</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOVO ORÇAMENTO DIÁRIO (R$)</label>
        <VariableAutocomplete
          value={(config.daily_budget as string) || ''}
          onChange={(v) => set('daily_budget', v)}
          placeholder="30 ou {{budget}}"
          rows={1}
        />
      </div>
    </>
  )
}
