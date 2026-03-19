'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { clientsApi, type Client } from '@/lib/api'
import type { InspectorFieldProps } from '../inspector'
import { ScoringConfig } from '@/components/clients/scoring-config'

export function EvaluateCampaignInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const params = useParams<{ id?: string }>()
  const clientId = params?.id

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    clientsApi.get(clientId)
      .then(c => setClient(c))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  const period = client?.scoring_config?.period ?? '7d'

  return (
    <>
      {/* Overrides opcionais no nó */}
      <div className="flex gap-2">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-syne font-semibold text-text3">THRESHOLD (override)</label>
          <input
            type="number"
            min={0} max={100}
            value={(config.threshold as number) ?? ''}
            onChange={(e) => set('threshold', e.target.value ? Number(e.target.value) : undefined)}
            placeholder={String(client?.scoring_config?.threshold ?? 60)}
            className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-syne font-semibold text-text3">PERÍODO (override)</label>
          <select
            value={(config.period as string) || ''}
            onChange={(e) => set('period', e.target.value || undefined)}
            className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2 text-xs focus:outline-none focus:border-accent"
          >
            <option value="">Padrão ({period})</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="14d">Últimos 14 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
        </div>
      </div>
      <p className="text-[10px] text-text3 -mt-1">Deixe em branco para usar as metas abaixo.</p>

      {/* Configuração de metas do cliente — inline */}
      {loading && <p className="text-[10px] text-text3 py-2">Carregando configuração...</p>}

      {!loading && !clientId && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-[8px] p-2.5 text-[10px] text-yellow-400">
          Esta automação não está associada a um cliente. Abra pelo menu de um cliente para configurar as metas.
        </div>
      )}

      {!loading && client && (
        <ScoringConfig client={client} onSaved={setClient} compact />
      )}

      {/* Saídas disponíveis */}
      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1.5">Saídas disponíveis</p>
        <p><code className="text-accent">{'{{pausar}}'}</code> — array de anúncios para pausar</p>
        <p><code className="text-accent">{'{{manter}}'}</code> — array de anúncios para manter</p>
        <p><code className="text-accent">{'{{alertar}}'}</code> — true quando cliente precisa de novos criativos</p>
        <p><code className="text-accent">{'{{motivo_alerta}}'}</code> — texto para enviar no WhatsApp</p>
        <p><code className="text-accent">{'{{resumo}}'}</code> — resumo da decisão</p>
        <p className="mt-1.5 font-syne font-bold text-text3">Fluxo recomendado:</p>
        <p>Buscar anúncios → Avaliar campanha → Loop (pausar) → Pausar → IF alertar → WhatsApp</p>
      </div>
    </>
  )
}
