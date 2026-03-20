'use client'

import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { InspectorFieldProps } from '../inspector'

export function WebhookInspector({ config, onChange, nodeId }: InspectorFieldProps) {
  const [copied, setCopied] = useState(false)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const base = typeof window !== 'undefined' && apiUrl.startsWith('/')
    ? `${window.location.origin}${apiUrl}`
    : apiUrl
  const webhookUrl = `${base}/webhooks/${nodeId}`

  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  const copy = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">URL DO WEBHOOK</label>
        <div className="flex items-center gap-1.5">
          <input
            readOnly
            value={webhookUrl}
            className="flex-1 h-8 rounded-[8px] bg-bg3 border border-[var(--border)] text-text3 px-2.5 text-[10px] font-mono cursor-default focus:outline-none"
          />
          <button
            type="button"
            onClick={copy}
            className="h-8 w-8 flex items-center justify-center rounded-[8px] bg-surface border border-[var(--border)] text-text3 hover:text-text transition-colors shrink-0"
          >
            {copied ? <Check size={13} className="text-green" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">MÉTODO</label>
        <div className="flex gap-1.5">
          {['GET', 'POST'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set('method', m)}
              className={`flex-1 h-8 rounded-[8px] text-xs font-syne font-bold transition-colors border ${
                (config.method || 'POST') === m
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-surface text-text3 border-[var(--border)] hover:border-[var(--border2)]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">SECRET (opcional)</label>
        <input
          type="password"
          value={(config.secret as string) || ''}
          onChange={(e) => set('secret', e.target.value)}
          placeholder="Token de validação"
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      </div>
    </>
  )
}
