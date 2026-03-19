'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { clientsApi, type ScoringConfig } from '@/lib/api'
import type { InspectorFieldProps } from '../inspector'
import Link from 'next/link'

const METRIC_LABELS: Record<string, string> = {
  ctr: 'CTR (%)',
  cpc: 'CPC (R$)',
  cpm: 'CPM (R$)',
  gasto: 'Gasto (R$)',
  roas: 'ROAS',
  frequencia: 'Frequência',
}

export function EvaluateCampaignInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const params = useParams<{ id?: string }>()
  const clientId = params?.id

  const [scoringConfig, setScoringConfig] = useState<ScoringConfig | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    clientsApi.get(clientId)
      .then(c => setScoringConfig(c.scoring_config ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  const rules = scoringConfig?.rules?.filter(r => r.enabled !== false) ?? []
  const threshold = scoringConfig?.threshold ?? 60
  const minDays = scoringConfig?.min_days_running ?? 7
  const maxDays = scoringConfig?.max_days_running ?? null
  const minActives = scoringConfig?.min_actives_fixed ?? 2

  return (
    <>
      {/* Overrides opcionais no nó */}
      <div className="flex gap-2">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-syne font-semibold text-text3">THRESHOLD (opcional)</label>
          <input
            type="number"
            min={0} max={100}
            value={(config.threshold as number) ?? ''}
            onChange={(e) => set('threshold', e.target.value ? Number(e.target.value) : undefined)}
            placeholder={String(threshold)}
            className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-syne font-semibold text-text3">PERÍODO (opcional)</label>
          <select
            value={(config.period as string) || ''}
            onChange={(e) => set('period', e.target.value || undefined)}
            className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2 text-xs focus:outline-none focus:border-accent"
          >
            <option value="">Padrão do cliente ({scoringConfig?.period ?? '7d'})</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="14d">Últimos 14 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
        </div>
      </div>
      <p className="text-[10px] text-text3 -mt-1">Deixe em branco para usar a configuração do cliente.</p>

      {/* Preview das regras do cliente */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-syne font-semibold text-text3">REGRAS DO CLIENTE</label>
          {clientId && (
            <Link
              href={`/clients/${clientId}?tab=performance`}
              className="text-[10px] text-accent hover:underline font-syne font-semibold"
              target="_blank"
            >
              Configurar metas →
            </Link>
          )}
        </div>

        {loading && <p className="text-[10px] text-text3">Carregando...</p>}

        {!loading && rules.length === 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-[8px] p-2.5 text-[10px] text-yellow-400">
            Nenhuma regra configurada.{' '}
            {clientId && (
              <Link href={`/clients/${clientId}?tab=performance`} className="underline" target="_blank">
                Configurar agora
              </Link>
            )}
          </div>
        )}

        {!loading && rules.length > 0 && (
          <>
            {/* Info rápida */}
            <div className="flex gap-2 text-[10px] text-text3">
              <span>Threshold: <span className="text-text font-mono">{threshold}</span></span>
              <span>·</span>
              <span>Mín. dias: <span className="text-text font-mono">{minDays}</span></span>
              {maxDays && <><span>·</span><span>Máx. dias: <span className="text-text font-mono">{maxDays}</span></span></>}
              <span>·</span>
              <span>Mín. ativos: <span className="text-text font-mono">{minActives}</span></span>
            </div>

            {/* Tabela de regras */}
            <div className="rounded-[8px] border border-[var(--border)] overflow-hidden">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-bg3 border-b border-[var(--border)]">
                    <th className="text-left px-2 py-1.5 text-text3 font-syne font-semibold">Métrica</th>
                    <th className="text-center px-2 py-1.5 text-text3 font-syne font-semibold">Op.</th>
                    <th className="text-right px-2 py-1.5 text-text3 font-syne font-semibold">Meta</th>
                    <th className="text-right px-2 py-1.5 text-text3 font-syne font-semibold">Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-2 py-1.5 text-text font-mono">{METRIC_LABELS[r.metric] ?? r.metric}</td>
                      <td className="px-2 py-1.5 text-text2 text-center font-mono">{r.operator}</td>
                      <td className="px-2 py-1.5 text-text text-right">{r.target}</td>
                      <td className="px-2 py-1.5 text-text3 text-right">{r.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

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
