'use client'

import type { InspectorFieldProps } from '../inspector'

const NOTE_COLORS = ['#505870', '#4f6fff', '#7b5fff', '#22c97a', '#ff8c42', '#ffd166']

export function NoteInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">CONTEÚDO</label>
        <textarea
          value={(config.content as string) || ''}
          onChange={(e) => set('content', e.target.value)}
          placeholder="Anotação sobre este fluxo..."
          rows={5}
          className="rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 py-2 text-xs focus:outline-none focus:border-accent resize-none placeholder:text-text3"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">COR</label>
        <div className="flex gap-2">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => set('color', color)}
              className="w-6 h-6 rounded-full border-2 transition-all"
              style={{
                backgroundColor: color,
                borderColor: config.color === color ? 'white' : 'transparent',
              }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
