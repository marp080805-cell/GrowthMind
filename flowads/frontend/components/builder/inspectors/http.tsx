'use client'

import { useState } from 'react'
import { VariableAutocomplete } from '../variable-autocomplete'
import { Plus, Trash2 } from 'lucide-react'
import type { InspectorFieldProps } from '../inspector'

export function HttpInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const headers = (config.headers as { key: string; value: string }[]) || []

  const addHeader = () => set('headers', [...headers, { key: '', value: '' }])
  const removeHeader = (i: number) => set('headers', headers.filter((_, idx) => idx !== i))
  const updateHeader = (i: number, field: 'key' | 'value', val: string) => {
    const updated = headers.map((h, idx) => idx === i ? { ...h, [field]: val } : h)
    set('headers', updated)
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">MÉTODO</label>
        <select
          value={(config.method as string) || 'GET'}
          onChange={(e) => set('method', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">URL</label>
        <VariableAutocomplete
          value={(config.url as string) || ''}
          onChange={(v) => set('url', v)}
          placeholder="https://api.exemplo.com/{{endpoint}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-syne font-semibold text-text3">HEADERS</label>
          <button type="button" onClick={addHeader} className="text-accent hover:text-accent/80 transition-colors">
            <Plus size={12} />
          </button>
        </div>
        {headers.map((h, i) => (
          <div key={i} className="flex gap-1">
            <input
              value={h.key}
              onChange={(e) => updateHeader(i, 'key', e.target.value)}
              placeholder="Chave"
              className="flex-1 h-7 rounded-[6px] bg-surface border border-[var(--border)] text-text px-2 text-[10px] focus:outline-none focus:border-accent"
            />
            <input
              value={h.value}
              onChange={(e) => updateHeader(i, 'value', e.target.value)}
              placeholder="Valor"
              className="flex-1 h-7 rounded-[6px] bg-surface border border-[var(--border)] text-text px-2 text-[10px] focus:outline-none focus:border-accent"
            />
            <button type="button" onClick={() => removeHeader(i)} className="text-red/60 hover:text-red transition-colors">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">BODY (JSON)</label>
        <VariableAutocomplete
          value={(config.body as string) || ''}
          onChange={(v) => set('body', v)}
          placeholder={'{\n  "key": "{{input.value}}"\n}'}
          rows={4}
          className="font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">AUTENTICAÇÃO</label>
        <select
          value={(config.auth as string) || 'none'}
          onChange={(e) => set('auth', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="none">Nenhuma</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
        </select>
      </div>

      {config.auth === 'bearer' && (
        <input
          value={(config.auth_token as string) || ''}
          onChange={(e) => set('auth_token', e.target.value)}
          placeholder="Token"
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      )}
    </>
  )
}
