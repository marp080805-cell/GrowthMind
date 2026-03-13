'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

export function WhatsappInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const message = (config.message as string) || ''

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
            placeholder="55{{cliente.whatsapp}}"
            rows={1}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">TIPO</label>
        <div className="flex gap-1.5">
          {[{ value: 'text', label: 'Texto' }, { value: 'file', label: 'Arquivo' }].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set('type', t.value)}
              className={`flex-1 h-8 rounded-[8px] text-xs font-syne font-bold transition-colors border ${
                (config.type || 'text') === t.value
                  ? 'bg-green/10 text-green border-green/30'
                  : 'bg-surface text-text3 border-[var(--border)] hover:border-[var(--border2)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {(config.type || 'text') === 'text' ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-syne font-semibold text-text3">MENSAGEM</label>
            <span className="text-[10px] text-text3">{message.length}/4096</span>
          </div>
          <VariableAutocomplete
            value={message}
            onChange={(v) => set('message', v)}
            placeholder="Olá {{cliente.nome}}! Relatório da semana..."
            rows={4}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">URL DO ARQUIVO</label>
          <VariableAutocomplete
            value={(config.file_url as string) || ''}
            onChange={(v) => set('file_url', v)}
            placeholder="{{input.url}}"
            rows={1}
          />
        </div>
      )}
    </>
  )
}
