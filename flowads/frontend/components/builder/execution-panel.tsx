'use client'

import { useState } from 'react'
import type { ExecutionLog, NodeLog } from '@/lib/api'

interface ExecutionPanelProps {
  executions: ExecutionLog[]
  liveExecutionId: string | null
  onClose: () => void
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatDuration(log: ExecutionLog) {
  if (!log.finished_at) return '—'
  const ms = new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'success') return <span className="text-green-400">✓</span>
  if (status === 'error') return <span className="text-red-400">✗</span>
  return <span className="text-yellow-400 animate-pulse">⟳</span>
}

function NodeLogRow({ nodeLog, isLast }: { nodeLog: NodeLog; isLast: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`border-b border-[var(--border)] ${isLast ? 'border-b-0' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface2 transition-colors text-left"
      >
        <StatusIcon status={nodeLog.status} />
        <span className="text-xs text-text flex-1 truncate">{nodeLog.node_label || nodeLog.node_type}</span>
        <span className="text-[10px] text-text3 font-mono shrink-0">{nodeLog.duration_ms}ms</span>
        <span className="text-text3 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {nodeLog.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-[6px] p-2 text-[10px] text-red-400 font-mono break-all">
              {nodeLog.error}
            </div>
          )}
          {nodeLog.output !== undefined && nodeLog.output !== null && (
            <div>
              <p className="text-[9px] font-syne font-bold text-text3 mb-1">SAÍDA</p>
              <pre className="text-[10px] text-text2 bg-bg3 rounded-[6px] p-2 overflow-auto max-h-32 font-mono">
                {JSON.stringify(nodeLog.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ExecutionPanel({ executions, liveExecutionId, onClose }: ExecutionPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    executions[0]?.id || null
  )

  // When new executions arrive, auto-select the live one
  const effectiveSelectedId = selectedId || executions[0]?.id || null
  const selectedExecution = executions.find((e) => e.id === effectiveSelectedId) || executions[0] || null

  return (
    <div className="h-[280px] border-t border-[var(--border)] bg-surface flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] shrink-0">
        <span className="text-xs font-syne font-bold text-text">Execuções</span>
        {liveExecutionId && (
          <span className="flex items-center gap-1 text-[10px] text-yellow-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
            rodando
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="text-text3 hover:text-text text-sm transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: execution list */}
        <div className="w-[220px] shrink-0 border-r border-[var(--border)] overflow-y-auto">
          {executions.length === 0 && (
            <p className="text-[11px] text-text3 px-3 py-4 text-center">Nenhuma execução ainda</p>
          )}
          {executions.map((exec) => {
            const isLive = exec.id === liveExecutionId
            const isSelected = exec.id === effectiveSelectedId
            return (
              <button
                key={exec.id}
                type="button"
                onClick={() => setSelectedId(exec.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] hover:bg-surface2 transition-colors text-left ${isSelected ? 'bg-surface2' : ''}`}
              >
                {isLive && exec.status === 'running' ? (
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                ) : (
                  <StatusIcon status={exec.status} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-text truncate">{formatDate(exec.started_at)}</p>
                  <p className="text-[9px] text-text3">{formatDuration(exec)}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right: node log detail */}
        <div className="flex-1 overflow-y-auto">
          {!selectedExecution && (
            <p className="text-[11px] text-text3 px-3 py-4 text-center">Selecione uma execução</p>
          )}
          {selectedExecution && selectedExecution.log_data?.length === 0 && (
            <p className="text-[11px] text-text3 px-3 py-4 text-center">Aguardando início...</p>
          )}
          {selectedExecution?.log_data?.map((nodeLog, i) => (
            <NodeLogRow
              key={nodeLog.node_id}
              nodeLog={nodeLog}
              isLast={i === (selectedExecution.log_data?.length ?? 0) - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
