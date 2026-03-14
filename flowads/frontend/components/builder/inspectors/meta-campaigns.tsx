'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

const STATUS_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'ACTIVE', label: 'Ativas' },
  { value: 'PAUSED', label: 'Pausadas' },
  { value: 'ARCHIVED', label: 'Arquivadas' },
]

export function FetchCampaignsInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">STATUS</label>
        <select
          value={(config.status as string) || ''}
          onChange={(e) => set('status', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{campanhas}}'}</code> — array de campanhas</p>
        <p><code className="text-accent">{'{{total}}'}</code> — total de campanhas</p>
      </div>
    </>
  )
}

const OBJECTIVES = [
  'OUTCOME_AWARENESS', 'OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS',
  'OUTCOME_SALES', 'OUTCOME_TRAFFIC', 'OUTCOME_APP_PROMOTION',
  'POST_ENGAGEMENT', 'LINK_CLICKS', 'CONVERSIONS',
]

export function CreateCampaignInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOME DA CAMPANHA *</label>
        <VariableAutocomplete
          value={(config.name as string) || ''}
          onChange={(v) => set('name', v)}
          placeholder="Minha campanha - {{hoje}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">OBJETIVO *</label>
        <select
          value={(config.objective as string) || 'OUTCOME_AWARENESS'}
          onChange={(e) => set('objective', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          {OBJECTIVES.map((o) => <option key={o} value={o}>{o.replace('OUTCOME_', '').replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">STATUS INICIAL</label>
        <select
          value={(config.status as string) || 'PAUSED'}
          onChange={(e) => set('status', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="PAUSED">Pausada</option>
          <option value="ACTIVE">Ativa</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ORÇAMENTO DIÁRIO (R$)</label>
        <VariableAutocomplete
          value={(config.daily_budget as string) || ''}
          onChange={(v) => set('daily_budget', v)}
          placeholder="50 ou {{budget}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">DATA DE FIM (opcional)</label>
        <input
          type="date"
          value={(config.stop_time as string) || ''}
          onChange={(e) => set('stop_time', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{campaign_id}}'}</code> — ID da campanha criada</p>
      </div>
    </>
  )
}

export function EditCampaignInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DA CAMPANHA *</label>
        <VariableAutocomplete
          value={(config.campaign_id as string) || ''}
          onChange={(v) => set('campaign_id', v)}
          placeholder="{{campaign_id}} ou 123456789"
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
          placeholder="50 ou {{novo_budget}}"
          rows={1}
        />
      </div>
    </>
  )
}

export function DuplicateCampaignInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DA CAMPANHA *</label>
        <VariableAutocomplete
          value={(config.campaign_id as string) || ''}
          onChange={(v) => set('campaign_id', v)}
          placeholder="{{campaign_id}} ou 123456789"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOME DA CÓPIA (opcional)</label>
        <VariableAutocomplete
          value={(config.new_name as string) || ''}
          onChange={(v) => set('new_name', v)}
          placeholder="Cópia - {{hoje}}"
          rows={1}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{campaign_id}}'}</code> — ID da nova campanha</p>
      </div>
    </>
  )
}
