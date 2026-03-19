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

  return (
    <>
      {/* Threshold override */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">THRESHOLD (override opcional)</label>
        <input
          type="number"
          min={0} max={100}
          value={(config.threshold as number) ?? ''}
          onChange={(e) => set('threshold', e.target.value ? Number(e.target.value) : undefined)}
          placeholder={String(client?.scoring_config?.threshold ?? 60)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
        <p className="text-[10px] text-text3">Deixe em branco para usar as metas configuradas abaixo.</p>
      </div>

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

      {/* Saídas — dois modos */}
      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3 space-y-2">
        <div>
          <p className="font-syne font-bold text-accent mb-1">Modo bulk — recebe {'{{anuncios}}'}</p>
          <p><code className="text-accent">{'{{pausar}}'}</code> — array para pausar</p>
          <p><code className="text-accent">{'{{manter}}'}</code> — array para manter</p>
          <p><code className="text-accent">{'{{alertar}}'}</code> — true se precisa de novos criativos</p>
          <p><code className="text-accent">{'{{motivo_alerta}}'}</code> — texto para WhatsApp</p>
          <p><code className="text-accent">{'{{resumo}}'}</code> — resumo da decisão</p>
          <p className="mt-1 text-text3/70">Fluxo: Buscar anúncios → Buscar métricas → Avaliar → Loop (pausar) → Pausar → IF alertar → WhatsApp</p>
        </div>
        <div className="border-t border-accent/10 pt-2">
          <p className="font-syne font-bold text-accent mb-1">Modo anúncio a anúncio — recebe {'{{item}}'} dentro de Loop</p>
          <p><code className="text-accent">{'{{pausar}}'}</code> — true/false</p>
          <p><code className="text-accent">{'{{manter}}'}</code> — true/false</p>
          <p><code className="text-accent">{'{{score}}'}</code> — pontuação 0-100</p>
          <p><code className="text-accent">{'{{motivo}}'}</code> — explicação da decisão</p>
          <p><code className="text-accent">{'{{skip_evaluation}}'}</code> — true se ainda em maturação</p>
          <p className="mt-1 text-text3/70">Fluxo: Buscar anúncios → Buscar métricas → Loop → Avaliar → IF pausar → Pausar</p>
        </div>
      </div>
    </>
  )
}
