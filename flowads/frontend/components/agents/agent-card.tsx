'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Agent } from '@/lib/api'
import { Bot, Pencil, Trash2, Brain } from 'lucide-react'

interface AgentCardProps {
  agent: Agent
  onEdit: (agent: Agent) => void
  onDelete: (agentId: string) => void
}

const providerBadge = (model: string) => {
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'info'
  if (model.startsWith('claude')) return 'purple'
  return 'default'
}

export function AgentCard({ agent, onEdit, onDelete }: AgentCardProps) {
  return (
    <div className="bg-surface border border-[var(--border)] rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-accent2/10 flex items-center justify-center shrink-0">
            <Bot size={18} className="text-accent2" />
          </div>
          <div>
            <p className="font-syne font-semibold text-text text-sm">{agent.name}</p>
            <Badge variant={providerBadge(agent.model)} className="mt-0.5">
              {agent.model}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => onEdit(agent)}>
            <Pencil size={14} />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(agent.id)}>
            <Trash2 size={14} className="text-red" />
          </Button>
        </div>
      </div>

      {agent.system_prompt && (
        <p className="text-xs text-text2 line-clamp-2 bg-bg3 rounded-[8px] px-3 py-2">
          {agent.system_prompt}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-text3">
        <div className="flex items-center gap-1">
          <Brain size={11} />
          <span>{agent.memory_enabled ? 'Memória ativa' : 'Sem memória'}</span>
        </div>
        <span>•</span>
        <span>Temp: {agent.temperature}</span>
        <span>•</span>
        <span>{agent.output_format === 'json' ? 'JSON' : 'Texto'}</span>
      </div>
    </div>
  )
}
