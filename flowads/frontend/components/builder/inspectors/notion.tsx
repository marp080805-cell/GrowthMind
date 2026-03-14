'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

export function NotionCreatePageInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO DATABASE *</label>
        <VariableAutocomplete
          value={(config.database_id as string) || ''}
          onChange={(v) => set('database_id', v)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          rows={1}
        />
        <p className="text-[10px] text-text3">Copie da URL do database no Notion</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">PROPRIEDADES (JSON)</label>
        <VariableAutocomplete
          value={typeof config.properties === 'object' ? JSON.stringify(config.properties, null, 2) : (config.properties as string) || '{\n  "Nome": {\n    "title": [{"text": {"content": "{{cliente.nome}}"}}]\n  }\n}'}
          onChange={(v) => set('properties', v)}
          rows={6}
          className="font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">CONTEÚDO (texto simples, opcional)</label>
        <VariableAutocomplete
          value={(config.content as string) || ''}
          onChange={(v) => set('content', v)}
          placeholder="Texto do corpo da página..."
          rows={3}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{page_id}}'}</code> — ID da página criada</p>
        <p><code className="text-accent">{'{{url}}'}</code> — URL da página</p>
      </div>
    </>
  )
}

export function NotionSearchPagesInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO DATABASE *</label>
        <VariableAutocomplete
          value={(config.database_id as string) || ''}
          onChange={(v) => set('database_id', v)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">FILTRO (JSON, opcional)</label>
        <VariableAutocomplete
          value={typeof config.filter === 'object' ? JSON.stringify(config.filter, null, 2) : (config.filter as string) || ''}
          onChange={(v) => set('filter', v)}
          placeholder={'{\n  "property": "Status",\n  "select": {"equals": "Ativo"}\n}'}
          rows={5}
          className="font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">LIMITE</label>
        <input
          type="number"
          min={1}
          max={100}
          value={(config.limit as number) || 10}
          onChange={(e) => set('limit', parseInt(e.target.value))}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{paginas}}'}</code> — array de páginas</p>
        <p><code className="text-accent">{'{{total}}'}</code> — total encontrado</p>
      </div>
    </>
  )
}

export function NotionUpdatePageInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DA PÁGINA *</label>
        <VariableAutocomplete
          value={(config.page_id as string) || ''}
          onChange={(v) => set('page_id', v)}
          placeholder="{{page_id}} ou ID fixo"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">PROPRIEDADES A ATUALIZAR (JSON) *</label>
        <VariableAutocomplete
          value={typeof config.properties === 'object' ? JSON.stringify(config.properties, null, 2) : (config.properties as string) || '{\n  "Status": {\n    "select": {"name": "Concluído"}\n  }\n}'}
          onChange={(v) => set('properties', v)}
          rows={6}
          className="font-mono"
        />
      </div>
    </>
  )
}

export function NotionReadDatabaseInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO DATABASE *</label>
        <VariableAutocomplete
          value={(config.database_id as string) || ''}
          onChange={(v) => set('database_id', v)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">LIMITE DE REGISTROS</label>
        <input
          type="number"
          min={1}
          max={100}
          value={(config.limit as number) || 100}
          onChange={(e) => set('limit', parseInt(e.target.value))}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{registros}}'}</code> — todos os registros</p>
        <p><code className="text-accent">{'{{total}}'}</code> — total de registros</p>
      </div>
    </>
  )
}
