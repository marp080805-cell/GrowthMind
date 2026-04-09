'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  EdgeLabelRenderer,
  BaseEdge,
  getSmoothStepPath,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type ReactFlowInstance,
  type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FlowNode } from './flow-node'
import { Inspector } from './inspector'
import { getBlock } from '@/lib/blocks'
import dagre from 'dagre'
import type { AutomationNode, AutomationEdge, NodeLog } from '@/lib/api'
import { automationsApi } from '@/lib/api'

const nodeTypes: NodeTypes = { flowNode: FlowNode as NodeTypes[string] }

// Custom edge with draggable midpoint for route control
function FlowEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected, markerEnd, style,
}: EdgeProps) {
  const edgeData = data as Record<string, unknown>
  const [midOffset, setMidOffset] = useState<{ x: number; y: number }>(
    edgeData?.midOffset as { x: number; y: number } || { x: 0, y: 0 }
  )
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const currentOffset = useRef(midOffset)
  currentOffset.current = midOffset

  const defaultMidX = (sourceX + targetX) / 2 + midOffset.x
  const defaultMidY = (sourceY + targetY) / 2 + midOffset.y

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    centerX: defaultMidX,
    centerY: defaultMidY,
    borderRadius: 12,
  })

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: midOffset.x, oy: midOffset.y }
    setDragging(true)

    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return
      const next = {
        x: dragStart.current.ox + (ev.clientX - dragStart.current.mx),
        y: dragStart.current.oy + (ev.clientY - dragStart.current.my),
      }
      setMidOffset(next)
    }
    const onUp = () => {
      setDragging(false)
      dragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // Persist final offset back to edge state via callback
      const persist = (edgeData?.onOffsetChange) as ((id: string, offset: { x: number; y: number }) => void) | undefined
      persist?.(id, currentOffset.current)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${defaultMidX}px,${defaultMidY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <div
            onMouseDown={onMouseDown}
            className={`w-3 h-3 rounded-full border-2 cursor-grab active:cursor-grabbing transition-all ${
              dragging || selected
                ? 'bg-accent border-accent opacity-100 scale-125'
                : 'bg-bg2 border-accent/40 opacity-0 hover:opacity-100'
            }`}
            title="Arraste para reposicionar a linha"
          />
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes: EdgeTypes = { flowEdge: FlowEdge as EdgeTypes[string] }

interface BuilderCanvasProps {
  initialNodes: AutomationNode[]
  initialEdges: AutomationEdge[]
  onChange: (nodes: AutomationNode[], edges: AutomationEdge[]) => void
  isActive?: boolean
  executionState?: Record<string, NodeLog>
  automationId?: string
}

function apiNodesToFlow(apiNodes: AutomationNode[], executionState: Record<string, NodeLog> = {}): Node[] {
  return apiNodes.map((n) => ({
    id: n.id,
    type: 'flowNode',
    position: n.position || { x: 100, y: 100 },
    data: {
      type: n.type,
      label: n.label,
      config: n.config || {},
      executionLog: executionState[n.id] || null,
    },
  }))
}

function apiEdgesToFlow(apiEdges: AutomationEdge[]): Edge[] {
  return apiEdges.map((e) => ({
    id: e.id,
    type: 'flowEdge',
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || 'default',
    targetHandle: e.targetHandle || 'default',
    animated: false,
    style: { stroke: 'var(--accent)', strokeWidth: 2 },
    data: { midOffset: e.data?.midOffset || { x: 0, y: 0 } },
  }))
}

function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40 })
  g.setDefaultEdgeLabel(() => ({}))
  nodes.forEach((n) => g.setNode(n.id, { width: 220, height: 100 }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map((n) => {
    const { x, y } = g.node(n.id)
    return { ...n, position: { x: x - 110, y: y - 50 } }
  })
}

export function BuilderCanvas({ initialNodes, initialEdges, onChange, isActive, executionState = {}, automationId }: BuilderCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(apiNodesToFlow(initialNodes, executionState))
  const [edges, setEdges, onEdgesChange] = useEdgesState(apiEdgesToFlow(initialEdges))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const wrapper = useRef<HTMLDivElement>(null)

  // ── Undo history ──────────────────────────────────────────────────────────
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([])
  const snapshotRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  snapshotRef.current = { nodes, edges }

  const pushHistory = () => {
    const { nodes: n, edges: e } = snapshotRef.current
    historyRef.current = [...historyRef.current.slice(-9), { nodes: n, edges: e }]
  }

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    setNodes(prev.nodes)
    setEdges(prev.edges)
    const apiNodes: AutomationNode[] = prev.nodes.map((n) => ({
      id: n.id,
      type: n.data.type as string,
      label: n.data.label as string,
      config: (n.data.config || {}) as Record<string, unknown>,
      position: n.position,
    }))
    const apiEdges: AutomationEdge[] = prev.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    }))
    onChange(apiNodes, apiEdges)
  }, [setNodes, setEdges, onChange])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Don't intercept if user is typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        handleUndo()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handleUndo])
  // ─────────────────────────────────────────────────────────────────────────

  // Update edge animation based on active state
  useEffect(() => {
    setEdges((eds) => eds.map((e) => ({ ...e, animated: isActive || false })))
  }, [isActive])

  // Update executionLog data on each node when executionState changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          executionLog: executionState[n.id] || null,
        },
      }))
    )
  }, [executionState])

  const notifyChange = useCallback(
    (ns: Node[], es: Edge[]) => {
      const apiNodes: AutomationNode[] = ns.map((n) => ({
        id: n.id,
        type: n.data.type as string,
        label: n.data.label as string,
        config: (n.data.config || {}) as Record<string, unknown>,
        position: n.position,
      }))
      const apiEdges: AutomationEdge[] = es.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
        data: { midOffset: (e.data as Record<string, unknown>)?.midOffset || { x: 0, y: 0 } },
      }))
      onChange(apiNodes, apiEdges)
    },
    [onChange]
  )

  // Persist edge midOffset when user finishes dragging the line
  const handleEdgeOffsetChange = useCallback((edgeId: string, offset: { x: number; y: number }) => {
    setEdges((eds) => {
      const updated = eds.map((e) =>
        e.id === edgeId ? { ...e, data: { ...(e.data as Record<string, unknown>), midOffset: offset } } : e
      )
      notifyChange(nodes, updated)
      return updated
    })
  }, [nodes, notifyChange])

  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistory()
      setEdges((eds) => {
        const newEdges = addEdge({
          ...connection,
          id: crypto.randomUUID(),
          type: 'flowEdge',
          animated: isActive,
          style: { stroke: 'var(--accent)', strokeWidth: 2 },
          data: {},
        }, eds)
        notifyChange(nodes, newEdges)
        return newEdges
      })
    },
    [nodes, isActive, notifyChange]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const blockType = e.dataTransfer.getData('application/admind-block')
      if (!blockType || !rfInstance || !wrapper.current) return

      const bounds = wrapper.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      })

      pushHistory()
      const block = getBlock(blockType)
      const newNode: Node = {
        id: crypto.randomUUID(),
        type: 'flowNode',
        position,
        data: {
          type: blockType,
          label: block?.label || blockType,
          config: (block as { defaultConfig?: Record<string, unknown> })?.defaultConfig || {},
          executionLog: null,
        },
      }

      setNodes((nds) => {
        const updated = [...nds, newNode]
        notifyChange(updated, edges)
        return updated
      })
    },
    [rfInstance, edges, notifyChange]
  )

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null

  const handleConfigChange = useCallback(
    (config: Record<string, unknown>) => {
      pushHistory()
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === selectedNodeId ? { ...n, data: { ...n.data, config } } : n
        )
        // For Switch nodes: remove edges whose sourceHandle no longer matches any case id or 'default'
        const changedNode = nds.find((n) => n.id === selectedNodeId)
        if (changedNode && (changedNode.data as { type?: string }).type === 'logic.switch') {
          const oldCases = ((changedNode.data as { config?: { cases?: Array<{ id: string }> } }).config?.cases) || []
          const newCases = (config.cases as Array<{ id: string }>) || []
          const validHandles = new Set([
            ...newCases.map((c) => c.id),
            'default',
          ])
          setEdges((eds) => {
            let filtered = eds.filter(
              (e) => e.source !== selectedNodeId || validHandles.has(e.sourceHandle ?? 'default')
            )
            // If cases were just configured for the first time, remove stale 'default' edges
            // (they were drawn from 'Padrão' handle before cases existed — user must reconnect)
            if (oldCases.length === 0 && newCases.length > 0) {
              filtered = filtered.filter(
                (e) => e.source !== selectedNodeId || e.sourceHandle !== 'default'
              )
            }
            notifyChange(updated, filtered)
            return filtered
          })
        } else {
          notifyChange(updated, edges)
        }
        return updated
      })
    },
    [selectedNodeId, edges, notifyChange]
  )

  const handleLabelChange = useCallback(
    (label: string) => {
      pushHistory()
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === selectedNodeId ? { ...n, data: { ...n.data, label } } : n
        )
        notifyChange(updated, edges)
        return updated
      })
    },
    [selectedNodeId, edges, notifyChange]
  )

  const handleDeleteNode = useCallback((nodeIdOverride?: string) => {
    const targetId = nodeIdOverride || selectedNodeId
    if (!targetId) return
    pushHistory()
    setNodes((nds) => {
      const updated = nds.filter((n) => n.id !== targetId)
      setEdges((eds) => {
        const filteredEdges = eds.filter(
          (e) => e.source !== targetId && e.target !== targetId
        )
        notifyChange(updated, filteredEdges)
        return filteredEdges
      })
      return updated
    })
    if (targetId === selectedNodeId) setSelectedNodeId(null)
  }, [selectedNodeId, notifyChange])

  const handleRunNode = useCallback(async (nodeId: string) => {
    if (!automationId) return
    // Mark target node as running
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, executionLog: { node_id: nodeId, status: 'running', duration_ms: 0, node_type: n.data.type as string, node_label: n.data.label as string, input: null, output: null } as NodeLog } }
        : n
    ))
    try {
      // Backend runs all predecessors first, then the target node
      const result = await automationsApi.runNode(automationId, nodeId, null)
      // Apply execution logs to ALL nodes that ran (predecessors + target)
      setNodes((nds) => nds.map((n) => {
        const nodeResult = result.nodeOutputs?.[n.id]
        if (!nodeResult) return n
        return {
          ...n,
          data: {
            ...n.data,
            executionLog: {
              node_id: n.id,
              status: nodeResult.error ? 'error' : 'success',
              output: nodeResult.output,
              error: nodeResult.error,
              duration_ms: nodeResult.duration_ms,
              input: nodeResult.input,
              node_type: n.data.type as string,
              node_label: n.data.label as string,
            } as NodeLog,
          },
        }
      }))
    } catch (err) {
      setNodes((nds) => nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, executionLog: { node_id: nodeId, status: 'error', error: err instanceof Error ? err.message : String(err), duration_ms: 0, input: null, output: null, node_type: n.data.type as string, node_label: n.data.label as string } as NodeLog } }
          : n
      ))
    }
  }, [automationId])

  const handleToggleNodeDisabled = useCallback((nodeId: string) => {
    pushHistory()
    setNodes((nds) => {
      const updated = nds.map((n) => {
        if (n.id !== nodeId) return n
        const config = (n.data.config as Record<string, unknown>) || {}
        return { ...n, data: { ...n.data, config: { ...config, _disabled: !config._disabled } } }
      })
      notifyChange(updated, edges)
      return updated
    })
  }, [edges, notifyChange])

  const handleAutoLayout = useCallback(() => {
    pushHistory()
    const laid = autoLayout(nodes, edges)
    setNodes(laid)
    notifyChange(laid, edges)
  }, [nodes, edges, notifyChange])

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Canvas */}
      <div ref={wrapper} className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes.map((n) => ({
            ...n,
            selected: n.id === selectedNodeId,
            data: {
              ...n.data,
              _onDelete: () => handleDeleteNode(n.id),
              _onRunNode: automationId ? () => handleRunNode(n.id) : undefined,
              _onToggleDisabled: () => handleToggleNodeDisabled(n.id),
            },
          }))}
          edges={edges.map((e) => ({
            ...e,
            data: { ...(e.data as Record<string, unknown>), onOffsetChange: handleEdgeOffsetChange },
          }))}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          snapToGrid
          snapGrid={[14, 14]}
          defaultEdgeOptions={{ type: 'flowEdge', style: { stroke: 'var(--accent)', strokeWidth: 2 }, data: {} }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1}
            color="rgba(255,255,255,0.04)"
          />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const block = getBlock(n.data?.type as string)
              return block ? `${block.color}60` : 'var(--surface2)'
            }}
            maskColor="rgba(8,10,15,0.8)"
          />
        </ReactFlow>

        {/* Auto-layout button */}
        <button
          onClick={handleAutoLayout}
          className="absolute top-3 right-3 bg-surface border border-[var(--border)] text-text2 hover:text-text hover:border-[var(--border2)] text-xs font-syne font-semibold px-3 py-1.5 rounded-[8px] transition-all z-10"
        >
          Auto-layout
        </button>
      </div>

      {/* Inspector */}
      {selectedNode && (() => {
        // Find the predecessor node (source of an edge pointing to selectedNode)
        // undefined = no previous node; null = has previous node but no execution data yet
        const incomingEdge = edges.find(e => e.target === selectedNode.id)
        const previousNodeLog = incomingEdge
          ? (executionState[incomingEdge.source] || null)
          : undefined
        return (
          <Inspector
            nodeId={selectedNode.id}
            nodeType={selectedNode.data.type as string}
            nodeLabel={(selectedNode.data.label as string) || ''}
            config={(selectedNode.data.config as Record<string, unknown>) || {}}
            onConfigChange={handleConfigChange}
            onLabelChange={handleLabelChange}
            onDelete={handleDeleteNode}
            onClose={() => setSelectedNodeId(null)}
            executionLog={(selectedNode.data.executionLog as NodeLog) || undefined}
            previousNodeLog={previousNodeLog}
            automationId={automationId}
          />
        )
      })()}
    </div>
  )
}
