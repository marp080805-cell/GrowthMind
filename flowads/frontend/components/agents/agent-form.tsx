'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { agentsApi, type Agent } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface AgentFormProps {
  clientId: string
  agent?: Agent
  onSuccess: (agent: Agent) => void
  onCancel: () => void
}

const MODELS = [
  { group: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'o1', 'o1-mini', 'o3-mini'] },
  { group: 'Anthropic', models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-sonnet-4-6'] },
]

export function AgentForm({ clientId, agent, onSuccess, onCancel }: AgentFormProps) {
  const { success, error } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: agent?.name || '',
    model: agent?.model || 'gpt-4o',
    system_prompt: agent?.system_prompt || '',
    human_message: agent?.human_message || '',
    temperature: agent?.temperature ?? 0.7,
    max_tokens: agent?.max_tokens ?? 1000,
    output_format: agent?.output_format || 'text' as 'text' | 'json',
    output_schema: agent?.output_schema ? JSON.stringify(agent.output_schema, null, 2) : '',
    memory_enabled: agent?.memory_enabled ?? false,
  })

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { error('Nome é obrigatório'); return }
    setLoading(true)
    try {
      const payload = {
        ...form,
        output_schema: form.output_schema
          ? JSON.parse(form.output_schema)
          : undefined,
      }
      const data = agent
        ? await agentsApi.update(clientId, agent.id, payload)
        : await agentsApi.create(clientId, payload)
      success(agent ? 'Agente atualizado!' : 'Agente criado!')
      onSuccess(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar agente'
      error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <Input label="Nome *" value={form.name} onChange={(e) => set('name', e.target.value)} required />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text2 font-syne">Modelo</label>
        <select
          value={form.model}
          onChange={(e) => set('model', e.target.value)}
          className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent"
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
        <label className="text-sm font-medium text-text2 font-syne">System Prompt</label>
        <textarea
          value={form.system_prompt}
          onChange={(e) => set('system_prompt', e.target.value)}
          placeholder="Você é um especialista em marketing digital para {{cliente.tipo_negocio}}. Contexto do cliente: {{cliente.contexto}}"
          rows={6}
          className="rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 py-2.5 text-sm focus:outline-none focus:border-accent resize-none placeholder:text-text3"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text2 font-syne">Human Message</label>
        <textarea
          value={form.human_message}
          onChange={(e) => set('human_message', e.target.value)}
          placeholder="Analise as métricas da semana: CTR {{metricas.ctr}}%, CPC R${{metricas.cpc}}"
          rows={3}
          className="rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 py-2.5 text-sm focus:outline-none focus:border-accent resize-none placeholder:text-text3"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text2 font-syne">
            Temperatura: {form.temperature}
          </label>
          <input
            type="range" min="0" max="1" step="0.1"
            value={form.temperature}
            onChange={(e) => set('temperature', parseFloat(e.target.value))}
            className="accent-accent"
          />
        </div>
        <Input
          label="Máx. tokens"
          type="number"
          value={form.max_tokens}
          onChange={(e) => set('max_tokens', parseInt(e.target.value))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text2 font-syne">Formato de saída</label>
        <div className="flex gap-2">
          {(['text', 'json'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => set('output_format', f)}
              className={`flex-1 h-9 rounded-[10px] text-sm font-syne font-semibold transition-all border ${
                form.output_format === f
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-surface text-text2 border-[var(--border)] hover:border-[var(--border2)]'
              }`}
            >
              {f === 'text' ? 'Texto livre' : 'JSON'}
            </button>
          ))}
        </div>
      </div>

      {form.output_format === 'json' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text2 font-syne">Schema JSON esperado</label>
          <textarea
            value={form.output_schema}
            onChange={(e) => set('output_schema', e.target.value)}
            placeholder={'{"titulo": "string", "corpo": "string"}'}
            rows={3}
            className="rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-accent resize-none placeholder:text-text3"
          />
        </div>
      )}

      <Toggle
        checked={form.memory_enabled}
        onChange={(v) => set('memory_enabled', v)}
        label="Memória de conversa (últimas 10 execuções)"
      />

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {agent ? 'Salvar agente' : 'Criar agente'}
        </Button>
      </div>
    </form>
  )
}
