'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getBlock, CATEGORY_COLORS } from '@/lib/blocks'
import { cn } from '@/lib/utils'
import type { NodeLog } from '@/lib/api'

export interface FlowNodeData extends Record<string, unknown> {
  type: string
  label?: string
  config?: Record<string, unknown>
  executionLog?: NodeLog | null
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
  return null
}

export const FlowNode = memo(function FlowNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData
  const block = getBlock(nodeData.type)
  if (!block) return null

  const color = CATEGORY_COLORS[block.category] || '#505870'
  const preview = getConfigPreview(nodeData.type, nodeData.config || {})
  const log = nodeData.executionLog as NodeLog | null | undefined

  // Execution ring color
  const ringClass = log
    ? log.status === 'success'
      ? 'ring-2 ring-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]'
      : log.status === 'error'
        ? 'ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
        : log.status === 'skipped'
          ? 'ring-1 ring-zinc-600 opacity-50'
          : 'ring-2 ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
    : ''

  return (
    <div
      className={cn(
        'min-w-[200px] max-w-[240px] rounded-[12px] border overflow-visible',
        'bg-surface shadow-lg transition-all duration-150 relative',
        selected
          ? 'border-accent shadow-[0_0_20px_rgba(79,111,255,0.2)]'
          : 'border-[var(--border)] hover:border-[var(--border2)]',
        ringClass
      )}
    >
      {/* Execution status badge */}
      {log && (
        <div className="absolute -top-2.5 -right-2 z-10 flex items-center gap-0.5">
          {log.status === 'success' && (
            <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono">
              ✓ {log.duration_ms}ms
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
      {block.handles.outputs.map((handle, i) => {
        const isMulti = block.handles.outputs.length > 1
        const label = isMulti
          ? handle === 'yes' ? 'Sim' : handle === 'no' ? 'Não' : handle === 'each' ? 'Cada item' : handle === 'done' ? 'Fim' : handle
          : undefined

        return (
          <Handle
            key={`out-${handle}`}
            type="source"
            position={Position.Bottom}
            id={handle}
            style={{
              background: color,
              border: '2px solid var(--surface)',
              width: 10,
              height: 10,
              left: isMulti ? `${((i + 1) / (block.handles.outputs.length + 1)) * 100}%` : '50%',
            }}
          >
            {label && (
              <span
                className="absolute text-[9px] font-syne font-bold whitespace-nowrap"
                style={{
                  bottom: -18,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color,
                }}
              >
                {label}
              </span>
            )}
          </Handle>
        )
      })}
    </div>
  )
})

FlowNode.displayName = 'FlowNode'
