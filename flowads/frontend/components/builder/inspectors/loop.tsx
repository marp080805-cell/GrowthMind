'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

export function LoopInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">LISTA PARA ITERAR</label>
        <VariableAutocomplete
          value={(config.list as string) || ''}
          onChange={(v) => set('list', v)}
          placeholder="{{input.campanhas}}"
          rows={1}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">VARIÁVEL DO ITEM</label>
        <input
          value={(config.item_var as string) || 'item'}
          onChange={(e) => set('item_var', e.target.value)}
          placeholder="item"
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
        <p className="text-[10px] text-text3">O item ficará disponível como {'{{' + (config.item_var as string || 'item') + '}}'}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ITENS POR VEZ (BATCH SIZE)</label>
        <input
          type="number"
          min={1}
          value={(config.batch_size as number) || 1}
          onChange={(e) => set('batch_size', Math.max(1, parseInt(e.target.value) || 1))}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
        <p className="text-[10px] text-text3">1 = um item por vez (padrão). &gt;1 = array de itens por iteração</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">LIMITE MÁX. DE ITERAÇÕES</label>
        <input
          type="number"
          value={(config.max_iterations as number) || 50}
          onChange={(e) => set('max_iterations', parseInt(e.target.value))}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      </div>
    </>
  )
}
