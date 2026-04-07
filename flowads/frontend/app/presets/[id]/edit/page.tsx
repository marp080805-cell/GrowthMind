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

export default function PresetEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { success, error } = useToast()

  const [preset, setPreset] = useState<Preset | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nodes, setNodes] = useState<AutomationNode[]>([])
  const [edges, setEdges] = useState<AutomationEdge[]>([])
  const [presetName, setPresetName] = useState('')

  // Debounce ref — auto-save 2s after last change
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    presetsApi.list()
      .then((all) => {
        const found = all.find((p) => p.id === id)
        if (!found) { error('Preset não encontrado'); router.push('/presets'); return }
        setPreset(found)
        setNodes(found.nodes || [])
        setEdges(found.edges || [])
        setPresetName(found.name)
      })
      .catch(() => error('Erro ao carregar preset'))
      .finally(() => setLoading(false))
  }, [id])

  const persistSave = useCallback(async (n: AutomationNode[], e: AutomationEdge[], name: string) => {
    if (!preset) return
    setSaving(true)
    try {
      await presetsApi.update(preset.id, {
        name,
        description: preset.description,
        icon: preset.icon,
        tags: preset.tags,
        nodes: n,
        edges: e,
      })
    } catch {
      error('Erro ao salvar preset')
    } finally {
      setSaving(false)
    }
  }, [preset])

  const handleChange = useCallback((newNodes: AutomationNode[], newEdges: AutomationEdge[]) => {
    setNodes(newNodes)
    setEdges(newEdges)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      persistSave(newNodes, newEdges, presetName)
    }, 2000)
  }, [presetName, persistSave])

  const handleSave = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await persistSave(nodes, edges, presetName)
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
          href="/presets"
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
        <BuilderCanvas
          key={id}
          initialNodes={nodes}
          initialEdges={edges}
          onChange={handleChange}
        />
      </div>

      <ToastProvider />
    </div>
  )
}
