'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

export function DriveListFilesInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DA PASTA (opcional)</label>
        <VariableAutocomplete
          value={(config.folder_id as string) || ''}
          onChange={(v) => set('folder_id', v)}
          placeholder="ID da pasta — deixe vazio para raiz"
          rows={1}
        />
        <p className="text-[10px] text-text3">Copie da URL da pasta no Drive</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">LIMITE</label>
        <input
          type="number"
          min={1}
          max={1000}
          value={(config.limit as number) || 50}
          onChange={(e) => set('limit', parseInt(e.target.value))}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{arquivos}}'}</code> — array de arquivos</p>
        <p><code className="text-accent">{'{{total}}'}</code> — total de arquivos</p>
        <p><code className="text-accent">{'{{arquivos.[0].id}}'}</code> — ID do primeiro arquivo</p>
        <p><code className="text-accent">{'{{arquivos.[0].webViewLink}}'}</code> — link</p>
      </div>
    </>
  )
}

export function DriveDownloadFileInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO ARQUIVO *</label>
        <VariableAutocomplete
          value={(config.file_id as string) || ''}
          onChange={(v) => set('file_id', v)}
          placeholder="{{arquivos.[0].id}} ou ID fixo"
          rows={1}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{file_id}}'}</code></p>
        <p><code className="text-accent">{'{{name}}'}</code></p>
        <p><code className="text-accent">{'{{download_url}}'}</code> — URL para download</p>
      </div>
    </>
  )
}

export function DriveUploadFileInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOME DO ARQUIVO *</label>
        <VariableAutocomplete
          value={(config.file_name as string) || ''}
          onChange={(v) => set('file_name', v)}
          placeholder="relatorio-{{mes_atual}}.pdf"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DA PASTA DESTINO (opcional)</label>
        <VariableAutocomplete
          value={(config.folder_id as string) || ''}
          onChange={(v) => set('folder_id', v)}
          placeholder="ID da pasta"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">DESCRIÇÃO (opcional)</label>
        <VariableAutocomplete
          value={(config.description as string) || ''}
          onChange={(v) => set('description', v)}
          placeholder="Relatório de {{mes_atual}}"
          rows={2}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{file_id}}'}</code> — ID do arquivo enviado</p>
        <p><code className="text-accent">{'{{name}}'}</code> — nome do arquivo</p>
      </div>
    </>
  )
}

export function DriveCreateFolderInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOME DA PASTA *</label>
        <VariableAutocomplete
          value={(config.folder_name as string) || ''}
          onChange={(v) => set('folder_name', v)}
          placeholder="Relatórios {{mes_atual}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DA PASTA PAI (opcional)</label>
        <VariableAutocomplete
          value={(config.parent_id as string) || ''}
          onChange={(v) => set('parent_id', v)}
          placeholder="ID da pasta pai"
          rows={1}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{folder_id}}'}</code> — ID da pasta criada</p>
        <p><code className="text-accent">{'{{name}}'}</code> — nome da pasta</p>
      </div>
    </>
  )
}
