'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { campaignsApi, type Campaign } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { ChevronDown, ChevronUp, Save } from 'lucide-react'

interface CampaignRowProps {
  campaign: Campaign
  clientId: string
}

const statusVariants: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  ARCHIVED: 'default',
  DELETED: 'error',
}

export function CampaignRow({ campaign, clientId }: CampaignRowProps) {
  const { success, error } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [context, setContext] = useState(campaign.context || '')
  const [saving, setSaving] = useState(false)

  const saveContext = async () => {
    setSaving(true)
    try {
      await campaignsApi.updateContext(clientId, campaign.id, context)
      success('Contexto salvo!')
    } catch {
      error('Erro ao salvar contexto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-bg3/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text truncate">{campaign.name}</p>
        </div>
        <Badge variant={statusVariants[campaign.status] || 'default'}>
          {campaign.status}
        </Badge>
        <span className="text-sm text-text2 w-28 text-right">{campaign.objective}</span>
        <span className="text-sm text-text2 w-24 text-right">
          {campaign.budget ? `R$ ${campaign.budget.toFixed(2)}` : '—'}
        </span>
        <button className="text-text3 hover:text-text2 transition-colors ml-2">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-bg3/30">
          <label className="text-xs font-syne font-semibold text-text3 mb-1.5 block">
            Contexto da campanha
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Descreva o objetivo, público, diferenciais desta campanha... Fica disponível como {{campanha.contexto}} nos agentes."
            rows={3}
            className="w-full rounded-[10px] bg-surface border border-[var(--border)] text-text px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-text3"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={saveContext}
            loading={saving}
            className="mt-2"
          >
            <Save size={13} />
            Salvar contexto
          </Button>
        </div>
      )}
    </div>
  )
}
