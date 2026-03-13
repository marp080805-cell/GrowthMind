'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

export function GenericInspector({ config, onChange }: InspectorFieldProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">CONFIGURAÇÃO (JSON)</label>
        <VariableAutocomplete
          value={JSON.stringify(config, null, 2)}
          onChange={(v) => {
            try { onChange(JSON.parse(v)) } catch { /* ignore */ }
          }}
          rows={8}
          className="font-mono"
        />
      </div>
    </div>
  )
}
