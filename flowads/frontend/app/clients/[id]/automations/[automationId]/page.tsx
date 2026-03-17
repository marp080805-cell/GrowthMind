'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BlockPalette } from '@/components/builder/palette'
import { BuilderCanvas } from '@/components/builder/canvas'
import { ExecutionPanel } from '@/components/builder/execution-panel'
import { ToastProvider } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Skeleton } from '@/components/ui/skeleton'
import { useAutomation } from '@/hooks/use-automation'
import {
  automationsApi,
  clientsApi,
  executionsApi,
  type AutomationNode,
  type AutomationEdge,
  type Client,
  type ExecutionLog,
  type NodeLog,
} from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Save, Play, Zap, AlignJustify } from 'lucide-react'
import Link from 'next/link'

export default function BuilderPage() {
  const { id: clientId, automationId } = useParams<{ id: string; automationId: string }>()
  const router = useRouter()
  const { automation, loading, saving, save, debouncedSave, toggle, setAutomation } = useAutomation(
    automationId === 'new' ? '' : automationId
  )
  const { success, error } = useToast()
  const [client, setClient] = useState<Client | null>(null)
  const [nodes, setNodes] = useState<AutomationNode[]>([])
  const [edges, setEdges] = useState<AutomationEdge[]>([])
  const [running, setRunning] = useState(false)
  const [automationName, setAutomationName] = useState('')

  // Execution state
  const [executions, setExecutions] = useState<ExecutionLog[]>([])
  const [liveExecutionId, setLiveExecutionId] = useState<string | null>(null)
  const [executionState, setExecutionState] = useState<Record<string, NodeLog>>({})
  const [showExecutions, setShowExecutions] = useState(false)
  const [pollingActive, setPollingActive] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  useEffect(() => {
    if (automationId === 'new') {
      setAutomationName('Nova Automação')
    }
  }, [automationId])

  // Load executions on open
  useEffect(() => {
    if (automationId !== 'new') {
      automationsApi.logs(automationId).then(setExecutions).catch(() => {})
    }
  }, [automationId])

  // Polling for live execution
  useEffect(() => {
    if (!pollingActive || !liveExecutionId) return

    pollingRef.current = setInterval(async () => {
      try {
        const log = await executionsApi.get(liveExecutionId)

        // Build per-node state map
        const state: Record<string, NodeLog> = {}
        for (const nodeLog of log.log_data || []) {
          state[nodeLog.node_id] = nodeLog
        }
        setExecutionState(state)

        // Refresh execution list
        const allLogs = await automationsApi.logs(automationId)
        setExecutions(allLogs)

        if (log.status !== 'running') {
          setPollingActive(false)
          setRunning(false)
          if (pollingRef.current) clearInterval(pollingRef.current)
        }
      } catch {
        // ignore transient errors
      }
    }, 1500)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [pollingActive, liveExecutionId, automationId])

  const handleChange = useCallback(
    (newNodes: AutomationNode[], newEdges: AutomationEdge[]) => {
      setNodes(newNodes)
      setEdges(newEdges)
      if (automationId !== 'new') debouncedSave(newNodes, newEdges)
    },
    [automationId, debouncedSave]
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
    setExecutionState({})
    try {
      const result = await automationsApi.run(automation.id)
      const execId = result.executionId
      if (execId) {
        setLiveExecutionId(execId)
        setPollingActive(true)
        setShowExecutions(true)
      } else {
        success('Automação iniciada! Verifique os logs em breve.')
        setRunning(false)
      }
    } catch {
      error('Erro ao executar automação')
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

        {/* Executions button */}
        <button
          type="button"
          onClick={() => setShowExecutions(!showExecutions)}
          className={`flex items-center gap-1.5 text-xs font-syne font-semibold px-3 py-1.5 rounded-[8px] border transition-all ${
            showExecutions
              ? 'bg-accent/10 border-accent text-accent'
              : 'bg-surface border-[var(--border)] text-text2 hover:text-text hover:border-[var(--border2)]'
          }`}
        >
          <AlignJustify size={12} />
          Execuções
          {executions.length > 0 && (
            <span className="bg-surface2 text-text3 rounded-full px-1.5 py-0.5 text-[10px] leading-none">
              {executions.length}
            </span>
          )}
        </button>

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
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          <BlockPalette />
          <BuilderCanvas
            key={automation?.id ?? automationId}
            initialNodes={automation?.nodes ?? nodes}
            initialEdges={automation?.edges ?? edges}
            onChange={handleChange}
            isActive={automation?.is_active}
            executionState={executionState}
          />
        </div>

        {showExecutions && (
          <ExecutionPanel
            executions={executions}
            liveExecutionId={liveExecutionId}
            onClose={() => setShowExecutions(false)}
          />
        )}
      </div>

      <ToastProvider />
    </div>
  )
}
