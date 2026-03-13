'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

const OPERATORS = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: 'contains', label: 'contém' },
  { value: 'not_contains', label: 'não contém' },
  { value: 'is_empty', label: 'está vazio' },
  { value: 'not_empty', label: 'não está vazio' },
]

export function ConditionalInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  const preview = (() => {
    const { variable, operator, value } = config as Record<string, string>
    if (!variable) return null
    if (!operator) return `${variable} ...`
    if (operator === 'is_empty' || operator === 'not_empty') return `${variable} ${OPERATORS.find((o) => o.value === operator)?.label}`
    return `${variable} ${OPERATORS.find((o) => o.value === operator)?.label || operator} ${value || ''}`
  })()

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">VARIÁVEL</label>
        <VariableAutocomplete
          value={(config.variable as string) || ''}
          onChange={(v) => set('variable', v)}
          placeholder="{{metricas.ctr}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">OPERADOR</label>
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

      {config.operator !== 'is_empty' && config.operator !== 'not_empty' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">VALOR</label>
          <input
            value={(config.value as string) || ''}
            onChange={(e) => set('value', e.target.value)}
            placeholder="2.5"
            className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {preview && (
        <div className="bg-bg3 rounded-[8px] p-2.5 border border-[var(--border)]">
          <p className="text-[10px] text-text3 mb-0.5">Preview</p>
          <p className="text-xs text-text font-mono">{preview}</p>
        </div>
      )}

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saídas</p>
        <p>✅ <strong>Sim</strong> — condição verdadeira</p>
        <p>❌ <strong>Não</strong> — condição falsa</p>
      </div>
    </>
  )
}
