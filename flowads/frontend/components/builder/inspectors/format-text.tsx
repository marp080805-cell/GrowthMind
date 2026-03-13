'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

export function FormatTextInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">TEMPLATE</label>
        <VariableAutocomplete
          value={(config.template as string) || ''}
          onChange={(v) => set('template', v)}
          placeholder="Relatório de {{mes_atual}} — Cliente: {{cliente.nome}}"
          rows={4}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOME DA VARIÁVEL DE SAÍDA</label>
        <input
          value={(config.output_var as string) || 'texto'}
          onChange={(e) => set('output_var', e.target.value)}
          placeholder="texto"
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
        <p className="text-[10px] text-text3">
          Disponível como {'{{' + (config.output_var as string || 'texto') + '}}'}
        </p>
      </div>
    </>
  )
}
