'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BlockPalette } from '@/components/builder/palette'
import { BuilderCanvas } from '@/components/builder/canvas'
import { ToastProvider } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Skeleton } from '@/components/ui/skeleton'
import { useAutomation } from '@/hooks/use-automation'
import { automationsApi, clientsApi, type AutomationNode, type AutomationEdge, type Client } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Save, Play, Zap } from 'lucide-react'
import Link from 'next/link'

export default function BuilderPage() {
  const { id: clientId, automationId } = useParams<{ id: string; automationId: string }>()
  const router = useRouter()
  const { automation, loading, saving, save, toggle, setAutomation } = useAutomation(
    automationId === 'new' ? '' : automationId
  )
  const { success, error } = useToast()
  const [client, setClient] = useState<Client | null>(null)
  const [nodes, setNodes] = useState<AutomationNode[]>([])
  const [edges, setEdges] = useState<AutomationEdge[]>([])
  const [running, setRunning] = useState(false)
  const [automationName, setAutomationName] = useState('')

  useEffect(() => {
    clientsApi.get(clientId).then(setClient).catch(() => {})
  }, [clientId])

  useEffect(() => {
    if (automation) {
      setNodes(automation.nodes || [])
      setEdges(automation.edges || [])
      setAutomationName(automation.name)
    }
  }, [automation])

  // Handle new automation
  useEffect(() => {
    if (automationId === 'new') {
      setAutomationName('Nova Automação')
    }
  }, [automationId])

  const handleChange = useCallback(
    (newNodes: AutomationNode[], newEdges: AutomationEdge[]) => {
      setNodes(newNodes)
      setEdges(newEdges)
      // Auto-save with debounce handled in parent
    },
    []
  )

  const handleSave = async () => {
    if (automationId === 'new') {
      try {
        const created = await automationsApi.create(clientId, {
          name: automationName,
          nodes: nodes as unknown as AutomationNode[],
          edges: edges as unknown as AutomationEdge[],
        } as unknown as Parameters<typeof automationsApi.create>[1])
        router.replace(`/clients/${clientId}/automations/${created.id}`)
        success('Automação criada!')
      } catch {
        error('Erro ao criar automação')
      }
    } else {
      await save(nodes, edges)
    }
  }

  const handleRun = async () => {
    if (!automation) return
    setRunning(true)
    try {
      await automationsApi.run(automation.id)
      success('Automação iniciada! Verifique os logs em breve.')
    } catch {
      error('Erro ao executar automação')
    } finally {
      setRunning(false)
    }
  }

  if (loading && automationId !== 'new') {
    return (
      <div className="flex h-screen bg-bg3 items-center justify-center">
        <div className="space-y-3 text-center">
          <Skeleton className="h-8 w-48 mx-auto" />
          <p className="text-text3 text-sm">Carregando builder...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-bg3 overflow-hidden">
      {/* Builder Topbar */}
      <div className="h-14 bg-bg2 border-b border-[var(--border)] flex items-center px-4 gap-3 shrink-0 z-20">
        {/* Back */}
        <Link
          href={`/clients/${clientId}`}
          className="flex items-center gap-1.5 text-text2 hover:text-text transition-colors text-sm"
        >
          <ArrowLeft size={16} />
        </Link>

        <div className="w-px h-5 bg-[var(--border)]" />

        {/* Automation name */}
        <input
          value={automationName}
          onChange={(e) => setAutomationName(e.target.value)}
          className="bg-transparent text-text font-syne font-semibold text-base focus:outline-none hover:text-accent focus:text-accent transition-colors min-w-[160px]"
        />

        {/* Client badge */}
        {client && (
          <div className="flex items-center gap-1.5 bg-surface border border-[var(--border)] rounded-[8px] px-2 py-1 text-xs text-text2">
            <Zap size={12} className="text-accent" />
            {client.name}
          </div>
        )}

        <div className="flex-1" />

        {/* Controls */}
        {automation && (
          <Toggle
            checked={automation.is_active}
            onChange={toggle}
            label={automation.is_active ? 'Ativo' : 'Inativo'}
          />
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRun}
          loading={running}
          disabled={!automation}
          title="Executar agora"
        >
          <Play size={14} />
          Testar agora
        </Button>

        <Button size="sm" onClick={handleSave} loading={saving}>
          <Save size={14} />
          Salvar
        </Button>
      </div>

      {/* Builder Body */}
      <div className="flex flex-1 overflow-hidden">
        <BlockPalette />
        <BuilderCanvas
          key={automation?.id ?? automationId}
          initialNodes={automation?.nodes ?? nodes}
          initialEdges={automation?.edges ?? edges}
          onChange={handleChange}
          isActive={automation?.is_active}
        />
      </div>

      <ToastProvider />
    </div>
  )
}
