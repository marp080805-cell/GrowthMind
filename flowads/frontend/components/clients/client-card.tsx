'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { getInitials, getAvatarColor } from '@/lib/utils'
import { Brain, Clock, Trash2 } from 'lucide-react'
import type { Client } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

interface ClientCardProps {
  client: Client
  onDelete?: (client: Client) => void
}

export function ClientCard({ client, onDelete }: ClientCardProps) {
  return (
    <div className="relative group bg-surface border border-[var(--border)] rounded-lg p-5 hover:border-[var(--border2)] hover:bg-surface2/30 transition-all">
      {onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); onDelete(client) }}
          className="absolute top-3 right-3 p-1.5 rounded-[8px] opacity-0 group-hover:opacity-100 hover:bg-red/10 text-text3 hover:text-red transition-all"
          title="Excluir cliente"
        >
          <Trash2 size={14} />
        </button>
      )}
      <Link href={`/clients/${client.id}`} className="block">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-syne font-bold text-white shrink-0"
              style={{ backgroundColor: getAvatarColor(client.name) }}
            >
              {getInitials(client.name)}
            </div>
            <div>
              <p className="font-syne font-semibold text-text">{client.name}</p>
              <p className="text-xs text-text2">{client.business_type}</p>
            </div>
          </div>
          <Badge variant={client.status === 'active' ? 'success' : 'warning'}>
            {client.status === 'active' ? 'Ativo' : 'Pausado'}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-text3">
          <div className="flex items-center gap-1.5">
            <Brain size={12} className="text-accent" />
            <span>{client.automations_count || 0} automações ativas</span>
          </div>
          {client.last_execution && (
            <div className="flex items-center gap-1">
              <Clock size={11} />
              <span>{formatDateTime(client.last_execution)}</span>
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
