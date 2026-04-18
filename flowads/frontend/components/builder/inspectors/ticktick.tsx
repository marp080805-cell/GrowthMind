'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

export function TickTickCreateTaskInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">TÍTULO *</label>
        <VariableAutocomplete
          value={(config.title as string) || ''}
          onChange={(v) => set('title', v)}
          placeholder="Ex: Ativar anúncios — {{hoje}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">DESCRIÇÃO / CONTEÚDO</label>
        <VariableAutocomplete
          value={(config.content as string) || ''}
          onChange={(v) => set('content', v)}
          placeholder="Posts criados nesta execução que precisam ser ativados manualmente..."
          rows={5}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">DATA DE VENCIMENTO (opcional)</label>
        <VariableAutocomplete
          value={(config.due_date as string) || ''}
          onChange={(v) => set('due_date', v)}
          placeholder="{{hoje}} ou 2026-04-20"
          rows={1}
        />
        <p className="text-[10px] text-text3">Formato: YYYY-MM-DD</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO PROJETO (opcional)</label>
        <VariableAutocomplete
          value={(config.project_id as string) || ''}
          onChange={(v) => set('project_id', v)}
          placeholder="Deixe vazio para usar Inbox"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">PRIORIDADE</label>
        <select
          value={(config.priority as number) ?? 0}
          onChange={(e) => set('priority', parseInt(e.target.value))}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value={0}>Nenhuma</option>
          <option value={1}>Baixa</option>
          <option value={3}>Média</option>
          <option value={5}>Alta</option>
        </select>
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{task_id}}'}</code> — ID da tarefa criada</p>
        <p><code className="text-accent">{'{{task_url}}'}</code> — Link direto para a tarefa</p>
      </div>
    </>
  )
}
