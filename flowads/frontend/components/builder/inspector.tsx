'use client'

import { getBlock } from '@/lib/blocks'
import { Button } from '@/components/ui/button'
import { X, Trash2 } from 'lucide-react'
import { ScheduleInspector } from './inspectors/schedule'
import { WebhookInspector } from './inspectors/webhook'
import { MetricsInspector } from './inspectors/metrics'
import { ConditionalInspector } from './inspectors/conditional'
import { LoopInspector } from './inspectors/loop'
import { WaitInspector } from './inspectors/wait'
import { HttpInspector } from './inspectors/http'
import { WhatsappInspector } from './inspectors/whatsapp'
import { FormatTextInspector } from './inspectors/format-text'
import { NoteInspector } from './inspectors/note'
import { AIAgentInspector } from './inspectors/ai-agent'
import { GenericInspector } from './inspectors/generic'

interface InspectorProps {
  nodeId: string
  nodeType: string
  nodeLabel: string
  config: Record<string, unknown>
  onConfigChange: (config: Record<string, unknown>) => void
  onLabelChange: (label: string) => void
  onDelete: () => void
  onClose: () => void
}

const INSPECTOR_MAP: Record<string, React.ComponentType<InspectorFieldProps>> = {
  'trigger.schedule': ScheduleInspector,
  'trigger.webhook': WebhookInspector,
  'meta.fetch_metrics': MetricsInspector,
  'logic.if': ConditionalInspector,
  'logic.loop': LoopInspector,
  'logic.wait': WaitInspector,
  'util.http': HttpInspector,
  'whatsapp.send_message': WhatsappInspector,
  'util.format_text': FormatTextInspector,
  'util.note': NoteInspector,
  'ai.agent': AIAgentInspector,
}

export interface InspectorFieldProps {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  nodeId: string
}

export function Inspector({
  nodeId,
  nodeType,
  nodeLabel,
  config,
  onConfigChange,
  onLabelChange,
  onDelete,
  onClose,
}: InspectorProps) {
  const block = getBlock(nodeType)
  const FieldComponent = INSPECTOR_MAP[nodeType] || GenericInspector

  return (
    <div className="w-[270px] h-full bg-bg2 border-l border-[var(--border)] flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-base">{block?.icon}</span>
          <span className="text-sm font-syne font-semibold text-text truncate">
            {block?.label || nodeType}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={onDelete} title="Deletar bloco">
            <Trash2 size={14} className="text-red" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Label field */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <label className="text-[10px] font-syne font-semibold text-text3 mb-1 block">
          NOME DO BLOCO
        </label>
        <input
          value={nodeLabel}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={block?.label}
          className="w-full h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <FieldComponent config={config} onChange={onConfigChange} nodeId={nodeId} />
      </div>
    </div>
  )
}
