'use client'

import type { InspectorFieldProps } from '../inspector'

export function GetAdMetricsInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">PERÍODO DE ANÁLISE</label>
        <select
          value={(config.period as string) || '7d'}
          onChange={(e) => set('period', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="14d">Últimos 14 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
        <p className="text-[10px] text-text3">Janela de tempo para calcular as métricas de cada anúncio.</p>
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1.5">O que este node faz</p>
        <p className="mb-1.5">Recebe o array <code className="text-accent">{'{{anuncios}}'}</code> e enriquece cada anúncio com suas métricas de performance no período selecionado.</p>
        <p className="font-syne font-bold text-accent mb-1">Saídas disponíveis</p>
        <p><code className="text-accent">{'{{anuncios}}'}</code> — array com métricas incluídas</p>
        <p className="mt-1 text-text3">Cada anúncio terá: <code className="text-text2">ctr, cpc, cpm, roas, frequencia, gasto, impressions, age_days</code></p>
        <p className="mt-1.5 font-syne font-bold text-text3">Fluxo recomendado:</p>
        <p>Buscar anúncios → Buscar métricas → Avaliar campanha</p>
      </div>
    </>
  )
}
