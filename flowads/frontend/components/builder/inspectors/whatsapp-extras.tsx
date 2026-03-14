'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

function NumberField({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NÚMERO</label>
        <select
          value={(config.number_type as string) || 'client'}
          onChange={(e) => set('number_type', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="client">Número do cliente</option>
          <option value="custom">Personalizado</option>
        </select>
        {config.number_type === 'custom' && (
          <VariableAutocomplete
            value={(config.number as string) || ''}
            onChange={(v) => set('number', v)}
            placeholder="5511999999999"
            rows={1}
          />
        )}
      </div>
    </>
  )
}

export function SendReportInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const message = (config.message as string) || ''

  return (
    <>
      <NumberField config={config} onChange={onChange} nodeId="" />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-syne font-semibold text-text3">RELATÓRIO</label>
          <span className="text-[10px] text-text3">{message.length}/4096</span>
        </div>
        <VariableAutocomplete
          value={message}
          onChange={(v) => set('message', v)}
          placeholder={`*Relatório {{cliente.nome}}*\n📅 {{semana_atual}}\n\n📊 *Métricas:*\n• Gasto: R$ {{metricas.gasto}}\n• CTR: {{metricas.ctr}}%\n• CPC: R$ {{metricas.cpc}}`}
          rows={8}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Formatação WhatsApp</p>
        <p>*negrito* | _itálico_ | ~riscado~ | ```código```</p>
      </div>
    </>
  )
}

export function SendFileInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <NumberField config={config} onChange={onChange} nodeId="" />

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">URL DO ARQUIVO *</label>
        <VariableAutocomplete
          value={(config.file_url as string) || ''}
          onChange={(v) => set('file_url', v)}
          placeholder="https://... ou {{arquivo_url}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">LEGENDA (opcional)</label>
        <VariableAutocomplete
          value={(config.caption as string) || ''}
          onChange={(v) => set('caption', v)}
          placeholder="Relatório de {{mes_atual}}"
          rows={2}
        />
      </div>
    </>
  )
}
