'use client'

import type { InspectorFieldProps } from '../inspector'

export function WaitInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-syne font-semibold text-text3">DURAÇÃO</label>
      <div className="flex gap-2">
        <input
          type="number"
          value={(config.duration as number) || 5}
          onChange={(e) => set('duration', parseInt(e.target.value))}
          className="flex-1 h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
        <select
          value={(config.unit as string) || 'seconds'}
          onChange={(e) => set('unit', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="seconds">Segundos</option>
          <option value="minutes">Minutos</option>
          <option value="hours">Horas</option>
        </select>
      </div>
    </div>
  )
}
