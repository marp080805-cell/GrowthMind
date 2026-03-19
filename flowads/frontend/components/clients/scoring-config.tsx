'use client'

import { useState } from 'react'
import { clientsApi, type Client, type ScoringRule, type ScoringConfig } from '@/lib/api'

const METRICS = [
  // ── Resultado principal ──────────────────────────────────────────────────
  { key: 'engajamentos',        label: 'Engajamentos',          hint: 'Total de engajamentos no post — maior é melhor (>=)', group: 'Resultado' },
  { key: 'leads',               label: 'Leads',                 hint: 'Total de leads gerados — maior é melhor (>=)', group: 'Resultado' },
  { key: 'compras',             label: 'Compras',               hint: 'Total de compras/conversões — maior é melhor (>=)', group: 'Resultado' },
  { key: 'seguidores',          label: 'Seguidores',            hint: 'Novos seguidores/likes na página — maior é melhor (>=)', group: 'Resultado' },
  { key: 'conversas_iniciadas', label: 'Conversas iniciadas',   hint: 'Conversas iniciadas (WhatsApp/DM) — maior é melhor (>=)', group: 'Resultado' },
  { key: 'adicoes_carrinho',    label: 'Adições ao carrinho',   hint: 'Total de adições ao carrinho — maior é melhor (>=)', group: 'Resultado' },
  { key: 'visualizacoes_video', label: 'Visualizações vídeo',  hint: 'Visualizações de 3 segundos — maior é melhor (>=)', group: 'Resultado' },
  { key: 'thruplay',            label: 'ThruPlay',              hint: 'Visualizações completas (ThruPlay) — maior é melhor (>=)', group: 'Resultado' },
  // ── Custo por resultado ──────────────────────────────────────────────────
  { key: 'cpe',            label: 'Custo/Engajamento (R$)', hint: 'CPE — menor é melhor (<=)', group: 'Custo p/ resultado' },
  { key: 'cpl',            label: 'Custo/Lead (R$)',        hint: 'CPL — menor é melhor (<=)', group: 'Custo p/ resultado' },
  { key: 'custo_mensagem', label: 'Custo/Mensagem (R$)',   hint: 'Custo por conversa WhatsApp — menor é melhor (<=)', group: 'Custo p/ resultado' },
  { key: 'custo_compra',   label: 'Custo/Compra (R$)',     hint: 'CPA de compra — menor é melhor (<=)', group: 'Custo p/ resultado' },
  { key: 'custo_seguidor', label: 'Custo/Seguidor (R$)',   hint: 'Gasto ÷ seguidores conquistados — menor é melhor (<=)', group: 'Custo p/ resultado' },
  { key: 'custo_conversa', label: 'Custo/Conversa (R$)',   hint: 'Custo por conversa iniciada — menor é melhor (<=)', group: 'Custo p/ resultado' },
  { key: 'custo_adicao',   label: 'Custo/Adição carrinho (R$)', hint: 'Custo por adição ao carrinho — menor é melhor (<=)', group: 'Custo p/ resultado' },
  { key: 'custo_thruplay', label: 'Custo/ThruPlay (R$)',   hint: 'Custo por visualização completa — menor é melhor (<=)', group: 'Custo p/ resultado' },
  // ── Qualidade do criativo ────────────────────────────────────────────────
  { key: 'ctr',        label: 'CTR (%)',         hint: 'Taxa de cliques — maior é melhor (>=)', group: 'Qualidade' },
  { key: 'cliques_link', label: 'Cliques no link', hint: 'Total de cliques no link — maior é melhor (>=)', group: 'Qualidade' },
  { key: 'hook_rate',  label: 'Hook Rate (%)',    hint: 'Visualizações 3s ÷ Impressões × 100 — maior é melhor (>=)', group: 'Qualidade' },
  // ── Saturação ───────────────────────────────────────────────────────────
  { key: 'frequencia', label: 'Frequência',       hint: 'Vezes que o mesmo usuário viu o anúncio — menor é melhor (<=)', group: 'Saturação' },
  // ── Distribuição / custo ────────────────────────────────────────────────
  { key: 'cpm',        label: 'CPM (R$)',          hint: 'Custo por mil impressões — menor é melhor (<=)', group: 'Distribuição' },
  { key: 'cpc',        label: 'CPC (R$)',          hint: 'Custo por clique — menor é melhor (<=)', group: 'Distribuição' },
  { key: 'alcance',    label: 'Alcance',           hint: 'Total de pessoas alcançadas — maior é melhor (>=)', group: 'Distribuição' },
  { key: 'impressoes', label: 'Impressões',        hint: 'Total de impressões — maior é melhor (>=)', group: 'Distribuição' },
  // ── Controle ────────────────────────────────────────────────────────────
  { key: 'gasto',      label: 'Gasto (R$)',        hint: 'Total gasto no período — controle de orçamento (<=)', group: 'Controle' },
  // ── Retorno ─────────────────────────────────────────────────────────────
  { key: 'roas',       label: 'ROAS',              hint: 'Retorno sobre investimento em compras — maior é melhor (>=)', group: 'Retorno' },
  { key: 'receita',    label: 'Receita (R$)',       hint: 'Valor total de compras geradas — maior é melhor (>=)', group: 'Retorno' },
]

const DEFAULT_OPERATORS: Record<string, '>=' | '<='> = {
  // maior é melhor
  ctr: '>=', roas: '>=', cliques_link: '>=', engajamentos: '>=', leads: '>=',
  compras: '>=', seguidores: '>=', conversas_iniciadas: '>=', adicoes_carrinho: '>=',
  visualizacoes_video: '>=', thruplay: '>=', hook_rate: '>=', alcance: '>=', impressoes: '>=', receita: '>=',
  // menor é melhor
  cpc: '<=', cpm: '<=', gasto: '<=', frequencia: '<=',
  cpe: '<=', cpl: '<=', custo_mensagem: '<=', custo_compra: '<=',
  custo_seguidor: '<=', custo_conversa: '<=', custo_adicao: '<=', custo_thruplay: '<=',
}

const PRESETS: Record<string, Partial<ScoringConfig>> = {
  engagement: {
    campaign_type: 'engagement',
    threshold: 60,
    period: '7d',
    min_days_running: 7,
    max_days_running: 15,
    min_actives_mode: 'fixed',
    min_actives_fixed: 3,
    rules: [
      // 1º meta de resultado
      { metric: 'cpe',       operator: '<=', target: 0.30, weight: 40, enabled: true },
      // 2º qualidade do criativo
      { metric: 'ctr',       operator: '>=', target: 2.0,  weight: 25, enabled: true },
      // 3º saturação
      { metric: 'frequencia', operator: '<=', target: 3.0, weight: 25, enabled: true },
      // 4º custo de distribuição
      { metric: 'cpm',       operator: '<=', target: 20,   weight: 10, enabled: true },
    ],
  },
  whatsapp_conversion: {
    campaign_type: 'whatsapp_conversion',
    threshold: 60,
    period: '7d',
    min_days_running: 7,
    max_days_running: null,
    min_actives_mode: 'fixed',
    min_actives_fixed: 3,
    rules: [
      // 1º meta de resultado
      { metric: 'custo_mensagem', operator: '<=', target: 3.0, weight: 40, enabled: true },
      // 2º qualidade do criativo
      { metric: 'ctr',       operator: '>=', target: 1.5,  weight: 25, enabled: true },
      // 3º saturação
      { metric: 'frequencia', operator: '<=', target: 4.0, weight: 20, enabled: true },
      // 4º custo de distribuição
      { metric: 'cpm',       operator: '<=', target: 25,   weight: 15, enabled: true },
    ],
  },
  lead_gen: {
    campaign_type: 'lead_gen',
    threshold: 60,
    period: '7d',
    min_days_running: 7,
    max_days_running: null,
    min_actives_mode: 'fixed',
    min_actives_fixed: 3,
    rules: [
      // 1º meta de resultado
      { metric: 'cpl',       operator: '<=', target: 15.0, weight: 40, enabled: true },
      // 2º qualidade do criativo
      { metric: 'ctr',       operator: '>=', target: 1.5,  weight: 25, enabled: true },
      // 3º saturação
      { metric: 'frequencia', operator: '<=', target: 4.0, weight: 20, enabled: true },
      // 4º custo de distribuição
      { metric: 'cpm',       operator: '<=', target: 30,   weight: 15, enabled: true },
    ],
  },
}

interface RuleRow extends ScoringRule {
  _id: string
}

interface ScoringConfigProps {
  client: Client
  onSaved: (updated: Client) => void
  compact?: boolean
}

export function ScoringConfig({ client, onSaved, compact }: ScoringConfigProps) {
  const initial = client.scoring_config ?? { rules: [] }

  const [campaignType, setCampaignType] = useState<string>(initial.campaign_type ?? '')
  const [threshold, setThreshold] = useState(initial.threshold ?? 60)
  const [period, setPeriod] = useState(initial.period ?? '7d')
  const [minDays, setMinDays] = useState(initial.min_days_running ?? 7)
  const [maxDays, setMaxDays] = useState<number | null | ''>(initial.max_days_running ?? '')
  const [minActivesMode, setMinActivesMode] = useState<'fixed' | 'budget_based'>(initial.min_actives_mode ?? 'fixed')
  const [minActivesFixed, setMinActivesFixed] = useState(initial.min_actives_fixed ?? 3)
  const [budgetPerCreative, setBudgetPerCreative] = useState(initial.budget_per_creative ?? 25)
  const [rules, setRules] = useState<RuleRow[]>(
    (initial.rules ?? []).map((r, i) => ({ ...r, _id: String(i) }))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const applyPreset = (type: string) => {
    const preset = PRESETS[type]
    if (!preset) return
    setCampaignType(type)
    if (preset.threshold !== undefined) setThreshold(preset.threshold)
    if (preset.period) setPeriod(preset.period)
    if (preset.min_days_running !== undefined) setMinDays(preset.min_days_running)
    setMaxDays(preset.max_days_running ?? '')
    if (preset.min_actives_mode) setMinActivesMode(preset.min_actives_mode)
    if (preset.min_actives_fixed !== undefined) setMinActivesFixed(preset.min_actives_fixed)
    if (preset.rules) setRules(preset.rules.map((r, i) => ({ ...r, _id: `preset_${i}` })))
  }

  const addRule = () => {
    setRules(prev => [...prev, {
      _id: Date.now().toString(),
      metric: 'ctr',
      operator: '>=',
      target: 0,
      weight: 0,
      enabled: true,
    }])
  }

  const removeRule = (id: string) => setRules(prev => prev.filter(r => r._id !== id))

  const updateRule = (id: string, patch: Partial<RuleRow>) => {
    setRules(prev => prev.map(r => {
      if (r._id !== id) return r
      const updated = { ...r, ...patch }
      // Auto-set default operator when metric changes
      if (patch.metric && !patch.operator) {
        updated.operator = DEFAULT_OPERATORS[patch.metric] ?? '>='
      }
      return updated
    }))
  }

  const totalWeight = rules.filter(r => r.enabled).reduce((s, r) => s + (r.weight || 0), 0)
  const weightError = totalWeight > 100

  const handleSave = async () => {
    setSaving(true)
    try {
      const scoring_config: ScoringConfig = {
        campaign_type: (campaignType as ScoringConfig['campaign_type']) || undefined,
        threshold,
        period,
        min_days_running: minDays,
        max_days_running: maxDays === '' ? null : maxDays as number | null,
        min_actives_mode: minActivesMode,
        min_actives_fixed: minActivesFixed,
        budget_per_creative: budgetPerCreative,
        rules: rules.map(({ _id, ...r }) => r),
      }
      const updated = await clientsApi.updateScoringConfig(client.id, scoring_config)
      onSaved(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Preset por tipo de campanha */}
      <div className="bg-surface border border-[var(--border)] rounded-lg p-4 space-y-3">
        <div>
          <p className={`${compact ? 'text-xs' : 'text-sm'} font-syne font-semibold text-text mb-0.5`}>Tipo de campanha</p>
          <p className="text-[10px] text-text3">Selecione para carregar valores padrão recomendados</p>
        </div>
        <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-3'}`}>
          {[
            { key: 'engagement', label: 'Engajamento', desc: 'Posts Instagram', icon: '📱' },
            { key: 'whatsapp_conversion', label: 'Conv. WhatsApp', desc: 'Mensagens diretas', icon: '💬' },
            { key: 'lead_gen', label: 'Leads', desc: 'Formulários/Site', icon: '🎯' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => applyPreset(t.key)}
              className={`rounded-lg border text-left transition-all ${compact ? 'px-3 py-2 flex items-center gap-2' : 'p-3'} ${
                campaignType === t.key
                  ? 'border-accent bg-accent/10'
                  : 'border-[var(--border)] bg-bg2 hover:border-accent/50'
              }`}
            >
              <div className={compact ? 'text-base' : 'text-lg mb-1'}>{t.icon}</div>
              <div>
                <div className="text-xs font-syne font-semibold text-text">{t.label}</div>
                <div className="text-[10px] text-text3">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Configurações gerais */}
      <div className="bg-surface border border-[var(--border)] rounded-lg p-4 space-y-4">
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-syne font-semibold text-text`}>Parâmetros gerais</p>

        <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">THRESHOLD DE APROVAÇÃO</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={100}
                value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                className="flex-1 h-8 rounded-[8px] bg-bg2 border border-[var(--border)] text-text px-2.5 text-sm focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-text3">/100</span>
            </div>
            <p className="text-[10px] text-text3">Score mínimo para aprovar o criativo</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">PERÍODO DE ANÁLISE</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="h-8 rounded-[8px] bg-bg2 border border-[var(--border)] text-text px-2 text-sm focus:outline-none focus:border-accent"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="14d">Últimos 14 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
          </div>
        </div>

        <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">MÍNIMO DE DIAS RODANDO</label>
            <input
              type="number" min={1}
              value={minDays}
              onChange={e => setMinDays(Number(e.target.value))}
              className="h-8 rounded-[8px] bg-bg2 border border-[var(--border)] text-text px-2.5 text-sm focus:outline-none focus:border-accent"
            />
            <p className="text-[10px] text-text3">Criativo só é avaliado após este período</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">MÁXIMO DE DIAS (opcional)</label>
            <input
              type="number" min={1}
              value={maxDays === null || maxDays === '' ? '' : maxDays}
              onChange={e => setMaxDays(e.target.value ? Number(e.target.value) : '')}
              placeholder="Sem limite"
              className="h-8 rounded-[8px] bg-bg2 border border-[var(--border)] text-text px-2.5 text-sm focus:outline-none focus:border-accent placeholder:text-text3"
            />
            <p className="text-[10px] text-text3">Força pausa após este período (ex: 15 para engagement)</p>
          </div>
        </div>

        {/* Mínimo de criativos ativos */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-syne font-semibold text-text3">MÍNIMO DE CRIATIVOS ATIVOS</label>
          <div className="flex gap-2">
            <button
              onClick={() => setMinActivesMode('fixed')}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-syne font-semibold border transition-all ${
                minActivesMode === 'fixed' ? 'bg-accent text-white border-accent' : 'bg-bg2 text-text3 border-[var(--border)] hover:border-accent/50'
              }`}
            >
              Fixo
            </button>
            <button
              onClick={() => setMinActivesMode('budget_based')}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-syne font-semibold border transition-all ${
                minActivesMode === 'budget_based' ? 'bg-accent text-white border-accent' : 'bg-bg2 text-text3 border-[var(--border)] hover:border-accent/50'
              }`}
            >
              Por orçamento
            </button>
          </div>

          {minActivesMode === 'fixed' ? (
            <div className="flex items-center gap-3">
              <input
                type="number" min={1}
                value={minActivesFixed}
                onChange={e => setMinActivesFixed(Number(e.target.value))}
                className="w-24 h-8 rounded-[8px] bg-bg2 border border-[var(--border)] text-text px-2.5 text-sm focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-text3">criativos sempre ativos no mínimo</p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-text3">R$</span>
              <input
                type="number" min={1}
                value={budgetPerCreative}
                onChange={e => setBudgetPerCreative(Number(e.target.value))}
                className="w-24 h-8 rounded-[8px] bg-bg2 border border-[var(--border)] text-text px-2.5 text-sm focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-text3">por criativo/dia → mínimo = orçamento ÷ este valor</p>
            </div>
          )}
        </div>
      </div>

      {/* Regras de métricas */}
      <div className="bg-surface border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <p className="text-sm font-syne font-semibold text-text">Regras de métricas</p>
          <span className={`text-xs font-mono font-semibold ${weightError ? 'text-red-400' : totalWeight === 100 ? 'text-green-400' : 'text-text3'}`}>
            Total: {totalWeight}%{weightError ? ' — excede 100%!' : totalWeight === 100 ? ' ✓' : ''}
          </span>
        </div>

        {/* Header — only in full mode */}
        {!compact && (
          <div className="flex items-center gap-2 px-4 py-2 bg-bg3 border-b border-[var(--border)] text-[10px] font-syne font-semibold text-text3">
            <span className="w-5" />
            <span className="flex-1">Métrica</span>
            <span className="w-16 text-center">Operador</span>
            <span className="w-20 text-right">Meta</span>
            <span className="w-32">Peso</span>
            <span className="w-5" />
          </div>
        )}

        {rules.length === 0 ? (
          <div className="py-6 text-center text-sm text-text3">
            Nenhuma regra. Selecione um preset acima ou adicione manualmente.
          </div>
        ) : compact ? (
          /* Compact: 2-line layout */
          rules.map((rule) => (
            <div key={rule._id} className={`px-3 py-2 border-b border-[var(--border)] last:border-0 transition-colors space-y-1.5 ${rule.enabled ? '' : 'opacity-50'}`}>
              {/* Line 1: checkbox + metric + delete */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={e => updateRule(rule._id, { enabled: e.target.checked })}
                  className="w-4 h-4 accent-accent cursor-pointer flex-shrink-0"
                />
                <select
                  value={rule.metric}
                  onChange={e => updateRule(rule._id, { metric: e.target.value as ScoringRule['metric'] })}
                  disabled={!rule.enabled}
                  className="flex-1 min-w-0 h-7 rounded-[6px] bg-bg2 border border-[var(--border)] text-text px-2 text-xs focus:outline-none focus:border-accent disabled:opacity-40"
                >
                  {(() => {
                    const groups = Array.from(new Set(METRICS.map(m => m.group)))
                    return groups.map(group => (
                      <optgroup key={group} label={group}>
                        {METRICS.filter(m => m.group === group).map(m => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </optgroup>
                    ))
                  })()}
                </select>
                <button
                  onClick={() => removeRule(rule._id)}
                  className="flex-shrink-0 w-5 text-text3 hover:text-red-400 transition-colors text-xs"
                >
                  ✕
                </button>
              </div>
              {/* Line 2: operator + target + weight */}
              <div className="flex items-center gap-1.5 pl-4">
                <select
                  value={rule.operator}
                  onChange={e => updateRule(rule._id, { operator: e.target.value as '>=' | '<=' })}
                  disabled={!rule.enabled}
                  className="w-12 h-7 rounded-[6px] bg-bg2 border border-[var(--border)] text-text px-1 text-xs text-center focus:outline-none focus:border-accent disabled:opacity-40"
                >
                  <option value=">=">&ge;</option>
                  <option value="<=">&le;</option>
                </select>
                <input
                  type="number" step="0.01"
                  value={rule.target}
                  onChange={e => updateRule(rule._id, { target: parseFloat(e.target.value) || 0 })}
                  disabled={!rule.enabled}
                  className="flex-1 h-7 rounded-[6px] bg-bg2 border border-[var(--border)] text-text px-2 text-xs text-right focus:outline-none focus:border-accent disabled:opacity-40"
                />
                <input
                  type="number" min={0} max={100} step={5}
                  value={rule.weight}
                  onChange={e => updateRule(rule._id, { weight: Number(e.target.value) })}
                  disabled={!rule.enabled}
                  placeholder="peso %"
                  className="w-16 h-7 rounded-[6px] bg-bg2 border border-[var(--border)] text-text px-2 text-xs text-right focus:outline-none focus:border-accent disabled:opacity-40"
                />
              </div>
            </div>
          ))
        ) : (
          /* Full: single-line layout */
          rules.map((rule) => (
            <div key={rule._id} className={`flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] last:border-0 transition-colors ${rule.enabled ? 'hover:bg-bg3/40' : 'opacity-50'}`}>
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={e => updateRule(rule._id, { enabled: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
              <select
                value={rule.metric}
                onChange={e => updateRule(rule._id, { metric: e.target.value as ScoringRule['metric'] })}
                disabled={!rule.enabled}
                className="flex-1 h-8 rounded-[8px] bg-bg2 border border-[var(--border)] text-text px-2 text-xs focus:outline-none focus:border-accent disabled:opacity-40"
              >
                {(() => {
                  const groups = Array.from(new Set(METRICS.map(m => m.group)))
                  return groups.map(group => (
                    <optgroup key={group} label={group}>
                      {METRICS.filter(m => m.group === group).map(m => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </optgroup>
                  ))
                })()}
              </select>
              <select
                value={rule.operator}
                onChange={e => updateRule(rule._id, { operator: e.target.value as '>=' | '<=' })}
                disabled={!rule.enabled}
                className="w-16 h-8 rounded-[8px] bg-bg2 border border-[var(--border)] text-text px-1 text-xs text-center focus:outline-none focus:border-accent disabled:opacity-40"
              >
                <option value=">=">&ge;</option>
                <option value="<=">&le;</option>
              </select>
              <input
                type="number" step="0.01"
                value={rule.target}
                onChange={e => updateRule(rule._id, { target: parseFloat(e.target.value) || 0 })}
                disabled={!rule.enabled}
                className="w-20 h-8 rounded-[8px] bg-bg2 border border-[var(--border)] text-text px-2.5 text-xs text-right focus:outline-none focus:border-accent disabled:opacity-40"
              />
              <div className="w-32 flex items-center gap-1.5">
                <input
                  type="range" min={0} max={100} step={5}
                  value={rule.weight}
                  onChange={e => updateRule(rule._id, { weight: Number(e.target.value) })}
                  disabled={!rule.enabled}
                  className="flex-1 accent-accent disabled:opacity-40 cursor-pointer"
                />
                <span className="text-[10px] text-text2 w-7 text-right font-mono">{rule.weight}%</span>
              </div>
              <button
                onClick={() => removeRule(rule._id)}
                className="w-5 text-text3 hover:text-red-400 transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          ))
        )}

        <div className="flex items-center justify-between px-4 py-2.5 bg-bg3 border-t border-[var(--border)]">
          <button
            onClick={addRule}
            className="text-xs text-accent hover:text-accent/80 font-syne font-semibold transition-colors flex items-center gap-1"
          >
            + Adicionar regra
          </button>
          <p className="text-[10px] text-text3">
            Os pesos são normalizados automaticamente — não precisam somar 100%
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || weightError}
          className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-syne font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar metas de performance'}
        </button>
      </div>
    </div>
  )
}
