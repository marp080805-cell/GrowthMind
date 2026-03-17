'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { campaignsApi, adsetsApi, type Campaign, type AdSet } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react'

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

function formatBudget(adset: AdSet): string {
  if (adset.daily_budget) return `R$ ${(parseInt(adset.daily_budget) / 100).toFixed(2)}/dia`
  if (adset.lifetime_budget) return `R$ ${(parseInt(adset.lifetime_budget) / 100).toFixed(2)} total`
  return '—'
}

export function CampaignRow({ campaign, clientId }: CampaignRowProps) {
  const { success, error } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [context, setContext] = useState(campaign.context || '')
  const [saving, setSaving] = useState(false)
  const [adsets, setAdsets] = useState<AdSet[]>([])
  const [loadingAdsets, setLoadingAdsets] = useState(false)
  const [adsetsLoaded, setAdsetsLoaded] = useState(false)

  const handleExpand = async () => {
    const next = !expanded
    setExpanded(next)
    if (next && !adsetsLoaded) {
      setLoadingAdsets(true)
      try {
        const data = await adsetsApi.list(clientId, campaign.meta_campaign_id)
        setAdsets(data)
        setAdsetsLoaded(true)
      } catch {
        // silently fail — adsets section just won't show
      } finally {
        setLoadingAdsets(false)
      }
    }
  }

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
        onClick={handleExpand}
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
        <div className="px-4 pb-4 bg-bg3/30 space-y-4">

          {/* Ad Sets */}
          <div>
            <p className="text-xs font-syne font-semibold text-text3 mb-2">Conjuntos de anúncios</p>
            {loadingAdsets ? (
              <div className="flex items-center gap-2 text-xs text-text3 py-2">
                <Loader2 size={13} className="animate-spin" />
                Carregando conjuntos...
              </div>
            ) : adsets.length === 0 ? (
              <p className="text-xs text-text3 py-2">Nenhum conjunto encontrado.</p>
            ) : (
              <div className="rounded-[10px] border border-[var(--border)] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-surface">
                      <th className="text-left px-3 py-2 text-text3 font-medium">Nome</th>
                      <th className="text-left px-3 py-2 text-text3 font-medium">Status</th>
                      <th className="text-left px-3 py-2 text-text3 font-medium">Otimização</th>
                      <th className="text-right px-3 py-2 text-text3 font-medium">Orçamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsets.map((adset) => (
                      <tr key={adset.id} className="border-b border-[var(--border)] last:border-0 hover:bg-bg3/40">
                        <td className="px-3 py-2 text-text">{adset.name}</td>
                        <td className="px-3 py-2">
                          <Badge variant={statusVariants[adset.status] || 'default'} className="text-[10px]">
                            {adset.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-text2">{adset.optimization_goal || '—'}</td>
                        <td className="px-3 py-2 text-text2 text-right">{formatBudget(adset)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Context */}
          <div>
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
        </div>
      )}
    </div>
  )
}
