'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { getInitials, getAvatarColor } from '@/lib/utils'
import { Zap, Clock } from 'lucide-react'
import type { Client } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

interface ClientCardProps {
  client: Client
}

export function ClientCard({ client }: ClientCardProps) {
  return (
    <Link
      href={`/clients/${client.id}`}
      className="bg-surface border border-[var(--border)] rounded-lg p-5 hover:border-[var(--border2)] hover:bg-surface2/30 transition-all cursor-pointer block"
    >
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
          <Zap size={12} className="text-accent" />
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
  )
}
