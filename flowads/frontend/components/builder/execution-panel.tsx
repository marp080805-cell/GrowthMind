'use client'

import { useState, useEffect } from 'react'
import type { ExecutionLog, NodeLog } from '@/lib/api'
import { OutputTree } from './output-tree'

interface ExecutionPanelProps {
  executions: ExecutionLog[]
  liveExecutionId: string | null
  onClose: () => void
  onSelectExecution?: (exec: ExecutionLog | null) => void
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

function statusColor(status: string) {
  if (status === 'success') return 'text-green-400'
  if (status === 'error') return 'text-red-400'
  if (status === 'skipped') return 'text-zinc-500'
  return 'text-yellow-400'
}

function StatusDot({ status }: { status: string }) {
  const base = 'w-2 h-2 rounded-full shrink-0'
  if (status === 'success') return <span className={`${base} bg-green-400`} />
  if (status === 'error') return <span className={`${base} bg-red-400`} />
  if (status === 'skipped') return <span className={`${base} bg-zinc-600`} />
  return <span className={`${base} bg-yellow-400 animate-pulse`} />
}

function statusLabel(status: string) {
  if (status === 'success') return 'Sucesso'
  if (status === 'error') return 'Erro'
  if (status === 'skipped') return 'Pulado'
  return 'Rodando'
}

type NodeTab = 'output' | 'input'

function NodeLogRow({ nodeLog, index }: { nodeLog: NodeLog; index: number }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<NodeTab>('output')

  const hasInput = nodeLog.input !== undefined && nodeLog.input !== null
  const hasOutput = nodeLog.output !== undefined && nodeLog.output !== null
  const hasError = !!nodeLog.error

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      {/* Row header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface2 transition-colors text-left ${open ? 'bg-surface2' : ''}`}
      >
        {/* Step number */}
        <span className="text-[9px] text-text3 font-mono w-4 shrink-0 text-right">{index + 1}</span>

        <StatusDot status={nodeLog.status} />

        <span className={`text-[11px] font-syne font-semibold flex-1 truncate ${statusColor(nodeLog.status)}`}>
          {nodeLog.node_label || nodeLog.node_type}
        </span>

        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-syne font-bold ${
          nodeLog.status === 'success' ? 'bg-green-500/10 text-green-400' :
          nodeLog.status === 'error' ? 'bg-red-500/10 text-red-400' :
          nodeLog.status === 'skipped' ? 'bg-zinc-500/10 text-zinc-500' :
          'bg-yellow-500/10 text-yellow-400'
        }`}>
          {statusLabel(nodeLog.status)}
        </span>

        <span className="text-[9px] text-text3 font-mono shrink-0 w-12 text-right">
          {nodeLog.duration_ms != null ? `${nodeLog.duration_ms}ms` : '—'}
        </span>

        <span className="text-text3 text-[10px] ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="bg-bg3 border-t border-[var(--border)]">
          {/* Error banner */}
          {hasError && (
            <div className="mx-3 mt-3 bg-red-500/10 border border-red-500/20 rounded-[6px] p-2 text-[10px] text-red-400 font-mono break-all">
              {nodeLog.error}
            </div>
          )}

          {/* INPUT / OUTPUT tabs */}
          <div className="flex border-b border-[var(--border)] mt-2">
            {(['output', 'input'] as NodeTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-[10px] font-syne font-bold transition-colors relative ${
                  tab === t
                    ? 'text-accent border-b-2 border-accent -mb-px'
                    : 'text-text3 hover:text-text'
                }`}
              >
                {t === 'output' ? 'SAÍDA' : 'ENTRADA'}
                {t === 'output' && hasOutput && tab !== 'output' && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
                )}
              </button>
            ))}
          </div>

          <div className="p-2 max-h-52 overflow-y-auto">
            {tab === 'output' && (
              hasOutput ? (
                <OutputTree data={nodeLog.output} path="output" />
              ) : (
                <p className="text-[10px] text-text3 py-3 text-center">
                  {nodeLog.status === 'skipped' ? 'Node pulado — sem saída' : 'Sem dados de saída'}
                </p>
              )
            )}
            {tab === 'input' && (
              hasInput ? (
                <OutputTree data={nodeLog.input} path="input" />
              ) : (
                <p className="text-[10px] text-text3 py-3 text-center">Sem dados de entrada</p>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ExecutionPanel({ executions, liveExecutionId, onClose, onSelectExecution }: ExecutionPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    executions[0]?.id || null
  )

  const effectiveSelectedId = selectedId || executions[0]?.id || null
  const selectedExecution = executions.find((e) => e.id === effectiveSelectedId) || executions[0] || null

  // Populate canvas on mount with the auto-selected execution
  useEffect(() => {
    if (selectedExecution) onSelectExecution?.(selectedExecution)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-select live execution when it becomes available
  useEffect(() => {
    if (liveExecutionId) {
      setSelectedId(liveExecutionId)
      const exec = executions.find((e) => e.id === liveExecutionId)
      if (exec) onSelectExecution?.(exec)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveExecutionId])

  function handleSelect(exec: ExecutionLog) {
    setSelectedId(exec.id)
    onSelectExecution?.(exec)
  }

  const successCount = selectedExecution?.log_data?.filter((n) => n.status === 'success').length ?? 0
  const errorCount = selectedExecution?.log_data?.filter((n) => n.status === 'error').length ?? 0
  const skippedCount = selectedExecution?.log_data?.filter((n) => n.status === 'skipped').length ?? 0

  return (
    <div className="h-[360px] border-t border-[var(--border)] bg-surface flex flex-col shrink-0">
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
        <div className="w-[200px] shrink-0 border-r border-[var(--border)] overflow-y-auto">
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
                onClick={() => handleSelect(exec)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)] hover:bg-surface2 transition-colors text-left ${isSelected ? 'bg-surface2 border-l-2 border-l-accent' : ''}`}
              >
                {isLive && exec.status === 'running' ? (
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                ) : (
                  <StatusDot status={exec.status} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-text truncate font-syne">{formatDate(exec.started_at)}</p>
                  <p className="text-[9px] text-text3 font-mono">{formatDuration(exec)}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right: execution detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Stats bar */}
          {selectedExecution && selectedExecution.log_data && selectedExecution.log_data.length > 0 && (
            <div className="flex items-center gap-4 px-4 py-1.5 border-b border-[var(--border)] bg-bg3 shrink-0">
              <span className="text-[9px] text-text3 font-syne font-semibold">
                {selectedExecution.log_data.length} nodes
              </span>
              {successCount > 0 && (
                <span className="text-[9px] text-green-400 font-syne font-semibold">✓ {successCount} ok</span>
              )}
              {errorCount > 0 && (
                <span className="text-[9px] text-red-400 font-syne font-semibold">✗ {errorCount} erro</span>
              )}
              {skippedCount > 0 && (
                <span className="text-[9px] text-zinc-500 font-syne font-semibold">— {skippedCount} pulados</span>
              )}
              <span className="flex-1" />
              <span className="text-[9px] text-text3 font-mono">{formatDuration(selectedExecution)}</span>
            </div>
          )}

          {/* Node list */}
          <div className="flex-1 overflow-y-auto">
            {!selectedExecution && (
              <p className="text-[11px] text-text3 px-3 py-4 text-center">Selecione uma execução</p>
            )}
            {selectedExecution && (!selectedExecution.log_data || selectedExecution.log_data.length === 0) && (
              <p className="text-[11px] text-text3 px-3 py-4 text-center">Aguardando início...</p>
            )}
            {selectedExecution?.log_data?.map((nodeLog, i) => (
              <NodeLogRow
                key={`${nodeLog.node_id}-${i}`}
                nodeLog={nodeLog}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
