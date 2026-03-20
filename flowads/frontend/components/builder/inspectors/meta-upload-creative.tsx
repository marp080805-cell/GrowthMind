'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

export function UploadCreativeInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">URL DO GOOGLE DRIVE *</label>
        <VariableAutocomplete
          value={(config.drive_url as string) || ''}
          onChange={(v) => set('drive_url', v)}
          placeholder="{{body.data.properties.Criativo.url}}"
          rows={1}
        />
        <p className="text-[10px] text-text3">
          Aceita link de compartilhamento do Drive (drive.google.com/file/d/...) ou variável do Notion.
          Requer Google Drive conectado em Configurações.
        </p>
      </div>

      <div className="bg-blue-500/5 rounded-[8px] p-2.5 border border-blue-500/10 text-[10px] text-text3 space-y-1">
        <p className="font-syne font-bold text-blue-400">Como funciona</p>
        <p>1. Baixa o arquivo do Google Drive usando seu token</p>
        <p>2. Detecta se é imagem ou vídeo pelo tipo MIME</p>
        <p>3. Para imagens: lê as dimensões → 9:16 vira <code className="text-blue-400">story</code>, outros viram <code className="text-blue-400">feed</code></p>
        <p>4. Para vídeos: nome com "story/reel" → story, caso contrário → feed</p>
        <p>5. Faz upload para a conta de anúncios Meta vinculada ao cliente</p>
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3 space-y-1">
        <p className="font-syne font-bold text-accent">Saída disponível</p>
        <p><code className="text-accent">{'{{image_hash}}'}</code> — hash da imagem (use em Criar anúncio)</p>
        <p><code className="text-accent">{'{{video_id}}'}</code> — ID do vídeo (use em Criar anúncio)</p>
        <p><code className="text-accent">{'{{type}}'}</code> — <code className="text-accent">image</code> ou <code className="text-accent">video</code></p>
        <p><code className="text-accent">{'{{placement_type}}'}</code> — <code className="text-accent">feed</code> ou <code className="text-accent">story</code></p>
        <p><code className="text-accent">{'{{width}}'}</code> / <code className="text-accent">{'{{height}}'}</code> — dimensões (imagens)</p>
        <p><code className="text-accent">{'{{nome_arquivo}}'}</code> — nome original do arquivo</p>
      </div>
    </>
  )
}
