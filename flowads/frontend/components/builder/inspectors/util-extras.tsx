'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

export function LogInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">LABEL (opcional)</label>
        <VariableAutocomplete
          value={(config.label as string) || ''}
          onChange={(v) => set('label', v)}
          placeholder="Debug métricas"
          rows={1}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Como funciona</p>
        <p>Registra o valor do input no log do servidor e passa o dado adiante sem modificar.</p>
        <p className="mt-1">Visible em: logs da execução no painel.</p>
      </div>
    </>
  )
}

export function SetVariableInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOME DA VARIÁVEL *</label>
        <input
          value={(config.variable as string) || ''}
          onChange={(e) => set('variable', e.target.value)}
          placeholder="minha_variavel"
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">VALOR *</label>
        <VariableAutocomplete
          value={(config.value as string) || ''}
          onChange={(v) => set('value', v)}
          placeholder="{{input.id}} ou valor fixo"
          rows={2}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Como usar</p>
        <p>Adiciona <code className="text-accent">{'{{minha_variavel}}'}</code> ao contexto do fluxo para usar nos próximos blocos.</p>
      </div>
    </>
  )
}
