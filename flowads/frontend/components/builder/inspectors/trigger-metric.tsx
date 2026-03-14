'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

const METRIC_OPTIONS = [
  { value: 'ctr', label: 'CTR (%)' },
  { value: 'cpc', label: 'CPC (R$)' },
  { value: 'cpm', label: 'CPM (R$)' },
  { value: 'gasto', label: 'Gasto (R$)' },
  { value: 'roas', label: 'ROAS' },
  { value: 'cliques', label: 'Cliques' },
  { value: 'impressoes', label: 'Impressões' },
]

const OPERATORS = [
  { value: '>', label: 'maior que (>)' },
  { value: '<', label: 'menor que (<)' },
  { value: '>=', label: 'maior ou igual (>=)' },
  { value: '<=', label: 'menor ou igual (<=)' },
]

export function TriggerMetricInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="bg-yellow-500/10 rounded-[8px] p-2.5 border border-yellow-500/20 text-[10px] text-text3 mb-1">
        <p className="font-syne font-bold text-yellow-400 mb-1">⚠️ Como usar</p>
        <p>Este trigger funciona em conjunto com o <strong>Agendamento</strong>. Configure o agendamento para disparar periodicamente, e este bloco verificará a condição da métrica antes de continuar.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">MÉTRICA</label>
        <select
          value={(config.metric as string) || 'ctr'}
          onChange={(e) => set('metric', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          {METRIC_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">CONDIÇÃO</label>
        <select
          value={(config.operator as string) || '>'}
          onChange={(e) => set('operator', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          {OPERATORS.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">VALOR</label>
        <VariableAutocomplete
          value={(config.threshold as string) || ''}
          onChange={(v) => set('threshold', v)}
          placeholder="2.5"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">PERÍODO</label>
        <select
          value={(config.period as string) || '7d'}
          onChange={(e) => set('period', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="today">Hoje</option>
          <option value="yesterday">Ontem</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="14d">Últimos 14 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
      </div>
    </>
  )
}
