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
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FlowNode } from './flow-node'
import { Inspector } from './inspector'
import { getBlock } from '@/lib/blocks'
import dagre from 'dagre'
import type { AutomationNode, AutomationEdge, NodeLog } from '@/lib/api'

const nodeTypes: NodeTypes = { flowNode: FlowNode as NodeTypes[string] }

interface BuilderCanvasProps {
  initialNodes: AutomationNode[]
  initialEdges: AutomationEdge[]
  onChange: (nodes: AutomationNode[], edges: AutomationEdge[]) => void
  isActive?: boolean
  executionState?: Record<string, NodeLog>
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
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || 'default',
    targetHandle: e.targetHandle || 'default',
    animated: false,
    style: { stroke: 'var(--accent)', strokeWidth: 2 },
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

export function BuilderCanvas({ initialNodes, initialEdges, onChange, isActive, executionState = {} }: BuilderCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(apiNodesToFlow(initialNodes, executionState))
  const [edges, setEdges, onEdgesChange] = useEdgesState(apiEdgesToFlow(initialEdges))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const wrapper = useRef<HTMLDivElement>(null)

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
      }))
      onChange(apiNodes, apiEdges)
    },
    [onChange]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge({
          ...connection,
          id: crypto.randomUUID(),
          animated: isActive,
          style: { stroke: 'var(--accent)', strokeWidth: 2 },
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
      const blockType = e.dataTransfer.getData('application/flowads-block')
      if (!blockType || !rfInstance || !wrapper.current) return

      const bounds = wrapper.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      })

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
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === selectedNodeId ? { ...n, data: { ...n.data, config } } : n
        )
        notifyChange(updated, edges)
        return updated
      })
    },
    [selectedNodeId, edges, notifyChange]
  )

  const handleLabelChange = useCallback(
    (label: string) => {
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

  const handleDeleteNode = useCallback(() => {
    setNodes((nds) => {
      const updated = nds.filter((n) => n.id !== selectedNodeId)
      setEdges((eds) => {
        const filteredEdges = eds.filter(
          (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
        )
        notifyChange(updated, filteredEdges)
        return filteredEdges
      })
      return updated
    })
    setSelectedNodeId(null)
  }, [selectedNodeId, notifyChange])

  const handleAutoLayout = useCallback(() => {
    const laid = autoLayout(nodes, edges)
    setNodes(laid)
    notifyChange(laid, edges)
  }, [nodes, edges, notifyChange])

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Canvas */}
      <div ref={wrapper} className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedNodeId }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[14, 14]}
          defaultEdgeOptions={{ style: { stroke: 'var(--accent)', strokeWidth: 2 } }}
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
      {selectedNode && (
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
        />
      )}
    </div>
  )
}
