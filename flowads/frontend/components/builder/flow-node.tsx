'use client'

import { memo, useState, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getBlock, CATEGORY_COLORS } from '@/lib/blocks'
import { cn } from '@/lib/utils'
import type { NodeLog } from '@/lib/api'

export interface FlowNodeData extends Record<string, unknown> {
  type: string
  label?: string
  config?: Record<string, unknown>
  executionLog?: NodeLog | null
  _onDelete?: () => void
  _onRunNode?: () => void
  _onToggleDisabled?: () => void
}

function getConfigPreview(type: string, config: Record<string, unknown>): string | null {
  if (!config) return null
  if (type === 'trigger.schedule') {
    const parts = []
    if (config.frequency) parts.push(config.frequency as string)
    if (config.time) parts.push(`às ${config.time}`)
    return parts.join(' ') || null
  }
  if (type === 'trigger.webhook') return config.url ? String(config.url).slice(0, 30) + '...' : 'URL gerada automaticamente'
  if (type === 'meta.fetch_metrics') return config.period ? `Período: ${config.period}` : null
  if (type === 'ai.agent') return config.model ? `Modelo: ${config.model}` : null
  if (type === 'logic.wait') return config.duration ? `${config.duration} ${config.unit || 's'}` : null
  if (type === 'logic.if') {
    const { variable, operator, value } = config as Record<string, string>
    if (variable && operator) return `${variable} ${operator} ${value || ''}`
  }
  if (type === 'logic.switch') {
    const cases = (config.cases as Array<{ label: string }>) || []
    if (cases.length > 0) return `${cases.length} caso${cases.length > 1 ? 's' : ''} + padrão`
    return 'Configure os casos'
  }
  return null
}

export const FlowNode = memo(function FlowNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData
  const block = getBlock(nodeData.type)
  const [hovered, setHovered] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showHover = () => { if (hideTimer.current) clearTimeout(hideTimer.current); setHovered(true) }
  const hideHover = () => { hideTimer.current = setTimeout(() => setHovered(false), 150) }

  if (!block) return null

  const color = CATEGORY_COLORS[block.category] || '#505870'
  const preview = getConfigPreview(nodeData.type, nodeData.config || {})
  const log = nodeData.executionLog as NodeLog | null | undefined
  const isDisabled = !!(nodeData.config as Record<string, unknown>)?._disabled

  // Compute output handles once (used for both Handle elements and labels)
  const outputs: { id: string; label?: string }[] = nodeData.type === 'logic.switch'
    ? [
        ...((nodeData.config?.cases as Array<{ id: string; label: string }>) || []).map(c => ({ id: c.id, label: c.label || c.id })),
        { id: 'default', label: 'Padrão' },
      ]
    : block.handles.outputs.map(h => {
        const label = block.handles.outputs.length > 1
          ? h === 'yes' ? 'Sim' : h === 'no' ? 'Não' : h === 'each' ? 'Cada item' : h === 'done' ? 'Fim' : h
          : undefined
        return { id: h, label }
      })

  const onDelete = nodeData._onDelete
  const onRunNode = nodeData._onRunNode
  const onToggleDisabled = nodeData._onToggleDisabled

  const ringClass = isDisabled
    ? 'ring-1 ring-zinc-600 opacity-50'
    : log
    ? log.status === 'success'
      ? 'ring-2 ring-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]'
      : log.status === 'error'
        ? 'ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
        : log.status === 'skipped'
          ? 'ring-1 ring-zinc-600 opacity-50'
          : 'ring-2 ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
    : ''

  const showToolbar = hovered && (onDelete || onRunNode || onToggleDisabled)

  return (
    <div
      onMouseEnter={showHover}
      onMouseLeave={hideHover}
      className={cn(
        'min-w-[200px] max-w-[240px] rounded-[12px] border overflow-visible',
        'bg-surface shadow-lg transition-all duration-150 relative',
        selected
          ? 'border-accent shadow-[0_0_20px_rgba(79,111,255,0.2)]'
          : 'border-[var(--border)] hover:border-[var(--border2)]',
        ringClass
      )}
    >
      {/* Hover toolbar */}
      {showToolbar && (
        <div className="absolute -top-9 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div
          className="pointer-events-auto flex items-center gap-0.5 bg-surface border border-[var(--border2)] rounded-[8px] px-1.5 py-1 shadow-xl nodrag nopan"
          onMouseEnter={showHover}
          onMouseLeave={hideHover}
        >
            {onRunNode && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRunNode() }}
                className="flex items-center gap-1 text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors text-[9px] font-syne font-bold px-1.5 py-0.5 rounded"
                title="Executar este node"
              >
                ▶ Run
              </button>
            )}
            {onRunNode && onToggleDisabled && (
              <div className="w-px h-3 bg-[var(--border)]" />
            )}
            {onToggleDisabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleDisabled() }}
                className={`text-[9px] font-syne font-bold px-1.5 py-0.5 rounded transition-colors ${
                  isDisabled
                    ? 'text-yellow-400 hover:bg-yellow-500/10'
                    : 'text-text2 hover:bg-surface2'
                }`}
                title={isDisabled ? 'Ativar node' : 'Desativar node'}
              >
                {isDisabled ? '● Ativar' : '○ Desativar'}
              </button>
            )}
            {(onRunNode || onToggleDisabled) && onDelete && (
              <div className="w-px h-3 bg-[var(--border)]" />
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-[10px] px-1.5 py-0.5 rounded"
                title="Deletar node"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Execution status badge */}
      {log && !isDisabled && (
        <div className="absolute -top-2.5 -right-2 z-10 flex items-center gap-0.5">
          {log.status === 'success' && (
            <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono">
              {nodeData.type === 'logic.loop' && (log.output as Record<string, unknown>)?.total != null
                ? (() => {
                    const o = log.output as Record<string, unknown>
                    const bs = (o.batch_size as number) || 1
                    return bs > 1
                      ? `↺ ${o.batches}x (${bs}/vez)`
                      : `↺ ${o.total}x`
                  })()
                : `✓ ${log.duration_ms}ms`}
            </span>
          )}
          {log.status === 'error' && (
            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              ✗ erro
            </span>
          )}
          {log.status === 'skipped' && (
            <span className="bg-zinc-700 text-zinc-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono">
              — pulado
            </span>
          )}
          {log.status === 'running' && (
            <span className="bg-yellow-400 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              ⟳ rodando
            </span>
          )}
        </div>
      )}

      {/* Disabled badge */}
      {isDisabled && (
        <div className="absolute -top-2.5 -right-2 z-10">
          <span className="bg-zinc-700 text-zinc-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            desativado
          </span>
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: color + '18', borderBottom: `1px solid ${color}30` }}
      >
        <span className="text-base leading-none">{block.icon}</span>
        <span className="text-xs font-syne font-bold text-text truncate flex-1">
          {nodeData.label || block.label}
        </span>
        <span
          className="text-[9px] font-syne font-bold px-1.5 py-0.5 rounded-md"
          style={{ backgroundColor: color + '30', color }}
        >
          {block.category.toUpperCase().slice(0, 4)}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-[11px] text-text2 leading-relaxed">{block.description}</p>
        {preview && (
          <p className="text-[10px] text-text3 mt-1.5 bg-bg3 rounded-[6px] px-2 py-1 truncate">
            {preview}
          </p>
        )}
      </div>

      {/* Input handles */}
      {block.handles.inputs.map((handle, i) => (
        <Handle
          key={`in-${handle}`}
          type="target"
          position={Position.Top}
          id={handle}
          style={{
            background: color,
            border: '2px solid var(--surface)',
            width: 10,
            height: 10,
            left: block.handles.inputs.length === 1 ? '50%' : `${((i + 1) / (block.handles.inputs.length + 1)) * 100}%`,
          }}
        />
      ))}

      {/* Output handles */}
      {outputs.map((out, i) => (
        <Handle
          key={`out-${out.id}`}
          type="source"
          position={Position.Bottom}
          id={out.id}
          style={{
            background: color,
            border: '2px solid var(--surface)',
            width: 10,
            height: 10,
            left: outputs.length === 1 ? '50%' : `${((i + 1) / (outputs.length + 1)) * 100}%`,
          }}
        />
      ))}

      {/* Output handle labels — rendered outside Handle to avoid pointer-event interference */}
      {outputs.map((out, i) => out.label && (
        <span
          key={`label-${out.id}`}
          className="absolute text-[9px] font-syne font-bold whitespace-nowrap pointer-events-none"
          style={{
            bottom: -18,
            left: outputs.length === 1 ? '50%' : `${((i + 1) / (outputs.length + 1)) * 100}%`,
            transform: 'translateX(-50%)',
            color,
          }}
        >
          {out.label}
        </span>
      ))}
    </div>
  )
})

FlowNode.displayName = 'FlowNode'
