'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BlockPalette } from '@/components/builder/palette'
import { BuilderCanvas } from '@/components/builder/canvas'
import { ToastProvider } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { presetsApi, type AutomationNode, type AutomationEdge, type Preset } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

// Referência estável — sem isso, executionState={} cria novo objeto a cada render
// e dispara o useEffect do BuilderCanvas em loop (React error #185)
const EMPTY_EXECUTION_STATE: Record<string, import('@/lib/api').NodeLog> = {}

export default function PresetEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { success, error } = useToast()

  const [preset, setPreset] = useState<Preset | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [presetName, setPresetName] = useState('')

  // Refs para dados em edição — não causam re-render, não realimentam o canvas
  const currentNodes = useRef<AutomationNode[]>([])
  const currentEdges = useRef<AutomationEdge[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    presetsApi.list()
      .then((all) => {
        const found = all.find((p) => p.id === id)
        if (!found) { error('Preset não encontrado'); router.push('/automacoes'); return }
        currentNodes.current = found.nodes || []
        currentEdges.current = found.edges || []
        setPreset(found)
        setPresetName(found.name)
      })
      .catch(() => error('Erro ao carregar preset'))
      .finally(() => setLoading(false))
  }, [id])

  const persistSave = useCallback(async (name: string) => {
    if (!preset) return
    setSaving(true)
    try {
      await presetsApi.update(preset.id, {
        name,
        description: preset.description,
        icon: preset.icon,
        tags: preset.tags,
        nodes: currentNodes.current,
        edges: currentEdges.current,
      })
    } catch {
      error('Erro ao salvar preset')
    } finally {
      setSaving(false)
    }
  }, [preset])

  const handleChange = useCallback((newNodes: AutomationNode[], newEdges: AutomationEdge[]) => {
    // Armazena em refs — sem setState para não re-renderizar e realimentar o canvas
    currentNodes.current = newNodes
    currentEdges.current = newEdges
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistSave(presetName), 2000)
  }, [presetName, persistSave])

  const handleSave = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await persistSave(presetName)
    success('Template salvo!')
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-bg3 items-center justify-center">
        <div className="space-y-3 text-center">
          <Skeleton className="h-8 w-48 mx-auto" />
          <p className="text-text3 text-sm">Carregando template...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-bg3 overflow-hidden">
      {/* Topbar */}
      <div className="h-14 bg-bg2 border-b border-[var(--border)] flex items-center px-4 gap-3 shrink-0 z-20">
        <Link
          href="/automacoes"
          className="flex items-center gap-1.5 text-text2 hover:text-text transition-colors text-sm"
        >
          <ArrowLeft size={16} />
        </Link>

        <div className="w-px h-5 bg-[var(--border)]" />

        <span className="text-lg">{preset?.icon}</span>

        <input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          className="bg-transparent text-text font-syne font-semibold text-base focus:outline-none hover:text-accent focus:text-accent transition-colors min-w-[160px]"
        />

        <div className="bg-surface border border-[var(--border)] rounded-[8px] px-2 py-1 text-xs text-text3">
          Template
        </div>

        <div className="flex-1" />

        <Button size="sm" onClick={handleSave} loading={saving}>
          <Save size={14} />
          Salvar
        </Button>
      </div>

      {/* Builder Body */}
      <div className="flex flex-1 overflow-hidden">
        <BlockPalette />
        {preset && (
          <BuilderCanvas
            key={preset.id}
            initialNodes={preset.nodes || []}
            initialEdges={preset.edges || []}
            onChange={handleChange}
            executionState={EMPTY_EXECUTION_STATE}
          />
        )}
      </div>

      <ToastProvider />
    </div>
  )
}
