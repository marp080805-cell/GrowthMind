'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { VariableAutocomplete } from '../variable-autocomplete'
import { agentsApi, type Agent } from '@/lib/api'
import type { InspectorFieldProps } from '../inspector'

const MODELS = [
  { group: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'o1', 'o1-mini', 'o3-mini'] },
  { group: 'Anthropic', models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-sonnet-4-6'] },
]

export function AIAgentInspector({ config, onChange }: InspectorFieldProps) {
  const params = useParams<{ id?: string }>()
  const clientId = params?.id
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    if (clientId) {
      agentsApi.list(clientId).then(setAgents).catch(() => {})
    }
  }, [clientId])

  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  const loadFromAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId)
    if (!agent) return
    onChange({
      ...config,
      name: agent.name,
      model: agent.model,
      system_prompt: agent.system_prompt,
      human_message: agent.human_message,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
      output_format: agent.output_format,
      output_schema: agent.output_schema ? JSON.stringify(agent.output_schema, null, 2) : '',
      memory_enabled: agent.memory_enabled,
      _agent_id: agent.id,
    })
  }

  return (
    <>
      {agents.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">CARREGAR DE AGENTE EXISTENTE</label>
          <select
            value={(config._agent_id as string) || ''}
            onChange={(e) => loadFromAgent(e.target.value)}
            className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
          >
            <option value="">Configurar manualmente...</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name} — {a.model}</option>
            ))}
          </select>
          <p className="text-[10px] text-text3">Ao selecionar, os campos abaixo são preenchidos com os dados do agente.</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOME</label>
        <input
          value={(config.name as string) || ''}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Analista de performance"
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">MODELO</label>
        <select
          value={(config.model as string) || 'gpt-4o'}
          onChange={(e) => set('model', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          {MODELS.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">SYSTEM PROMPT</label>
        <VariableAutocomplete
          value={(config.system_prompt as string) || ''}
          onChange={(v) => set('system_prompt', v)}
          placeholder="Você é um especialista em marketing para {{cliente.tipo_negocio}}..."
          rows={5}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">HUMAN MESSAGE</label>
        <VariableAutocomplete
          value={(config.human_message as string) || ''}
          onChange={(v) => set('human_message', v)}
          placeholder="Analise: CTR {{metricas.ctr}}%, CPC {{metricas.cpc}}"
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">
          TEMPERATURA: {(config.temperature as number) ?? 0.7}
        </label>
        <input
          type="range" min="0" max="1" step="0.1"
          value={(config.temperature as number) ?? 0.7}
          onChange={(e) => set('temperature', parseFloat(e.target.value))}
          className="accent-accent2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">MÁX. TOKENS</label>
        <input
          type="number"
          value={(config.max_tokens as number) || 1000}
          onChange={(e) => set('max_tokens', parseInt(e.target.value))}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">FORMATO DE SAÍDA</label>
        <div className="flex gap-1.5">
          {[{ value: 'text', label: 'Texto livre' }, { value: 'json', label: 'JSON' }].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => set('output_format', f.value)}
              className={`flex-1 h-8 rounded-[8px] text-xs font-syne font-bold transition-colors border ${
                (config.output_format || 'text') === f.value
                  ? 'bg-accent2/10 text-accent2 border-accent2/30'
                  : 'bg-surface text-text3 border-[var(--border)] hover:border-[var(--border2)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {config.output_format === 'json' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">SCHEMA JSON</label>
          <textarea
            value={(config.output_schema as string) || ''}
            onChange={(e) => set('output_schema', e.target.value)}
            placeholder={'{"titulo": "string", "corpo": "string"}'}
            rows={3}
            className="rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 py-2 text-[10px] font-mono focus:outline-none focus:border-accent resize-none placeholder:text-text3"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="memory"
          checked={(config.memory_enabled as boolean) || false}
          onChange={(e) => set('memory_enabled', e.target.checked)}
          className="accent-accent2"
        />
        <label htmlFor="memory" className="text-xs text-text2 cursor-pointer">
          Memória de conversa
        </label>
      </div>
    </>
  )
}
