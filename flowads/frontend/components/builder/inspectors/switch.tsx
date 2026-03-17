'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'
import { Plus, Trash2 } from 'lucide-react'

interface SwitchCase {
  id: string
  label: string
  value: string
}

function generateId() {
  return `case_${Math.random().toString(36).slice(2, 8)}`
}

export function SwitchInspector({ config, onChange }: InspectorFieldProps) {
  const cases = (config.cases as SwitchCase[]) || []
  const variable = (config.variable as string) || ''

  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  const addCase = () => {
    const newCase: SwitchCase = { id: generateId(), label: `Caso ${cases.length + 1}`, value: '' }
    set('cases', [...cases, newCase])
  }

  const updateCase = (id: string, field: keyof SwitchCase, value: string) => {
    set('cases', cases.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const removeCase = (id: string) => {
    set('cases', cases.filter(c => c.id !== id))
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">VARIÁVEL A VERIFICAR</label>
        <VariableAutocomplete
          value={variable}
          onChange={(v) => set('variable', v)}
          placeholder="{{item.caption}}"
          rows={1}
        />
        <p className="text-[10px] text-text3">Valor que será comparado em cada caso (case-insensitive)</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-syne font-semibold text-text3">CASOS</label>
          <button
            onClick={addCase}
            className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 font-syne font-bold transition-colors"
          >
            <Plus size={11} /> Adicionar caso
          </button>
        </div>

        {cases.length === 0 && (
          <p className="text-[10px] text-text3 italic py-1">Nenhum caso adicionado. Clique em "Adicionar caso".</p>
        )}

        {cases.map((c, i) => (
          <div key={c.id} className="bg-bg3 border border-[var(--border)] rounded-[8px] p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-syne font-bold text-accent">Saída {i + 1}</span>
              <button
                onClick={() => removeCase(c.id)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-text3">RÓTULO (nome da saída no canvas)</label>
              <input
                value={c.label}
                onChange={(e) => updateCase(c.id, 'label', e.target.value)}
                placeholder="Almoço"
                className="h-7 rounded-[6px] bg-surface border border-[var(--border)] text-text px-2 text-xs focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-text3">CONTÉM (palavra ou trecho)</label>
              <input
                value={c.value}
                onChange={(e) => updateCase(c.id, 'value', e.target.value)}
                placeholder="almoço"
                className="h-7 rounded-[6px] bg-surface border border-[var(--border)] text-text px-2 text-xs focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3 space-y-0.5">
        <p className="font-syne font-bold text-accent mb-1">Saídas geradas</p>
        {cases.map((c) => (
          <p key={c.id}>▸ <strong>{c.label || c.id}</strong> — contém "{c.value}"</p>
        ))}
        <p>▸ <strong>Padrão</strong> — nenhum caso correspondeu</p>
      </div>
    </>
  )
}
