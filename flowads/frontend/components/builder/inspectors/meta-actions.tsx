'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

// ─── Pausar / Ativar / Excluir ────────────────────────────────────────────────

export function PauseActivateInspector({ config, onChange, nodeId }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const nodeType = nodeId // not ideal but we detect from label config
  const isDelete = (config._action as string) === 'delete'

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">TIPO DE OBJETO</label>
        <select
          value={(config.object_type as string) || 'ad'}
          onChange={(e) => set('object_type', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="campaign">Campanha</option>
          <option value="adset">Adset</option>
          <option value="ad">Anúncio</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO OBJETO *</label>
        <VariableAutocomplete
          value={(config.object_id as string) || (config.ad_id as string) || (config.adset_id as string) || (config.campaign_id as string) || ''}
          onChange={(v) => set('object_id', v)}
          placeholder="{{ad_id}} ou {{campaign_id}}"
          rows={1}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{object_id}}'}</code> — ID do objeto alterado</p>
      </div>
    </>
  )
}

// ─── Ajustar Orçamento ────────────────────────────────────────────────────────

export function AdjustBudgetInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">TIPO DE OBJETO</label>
        <select
          value={(config.object_type as string) || 'campaign'}
          onChange={(e) => set('object_type', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="campaign">Campanha</option>
          <option value="adset">Adset</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO OBJETO *</label>
        <VariableAutocomplete
          value={(config.object_id as string) || (config.campaign_id as string) || (config.adset_id as string) || ''}
          onChange={(v) => set('object_id', v)}
          placeholder="{{campaign_id}} ou {{adset_id}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">TIPO DE ORÇAMENTO</label>
        <select
          value={(config.budget_type as string) || 'daily'}
          onChange={(e) => set('budget_type', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="daily">Diário</option>
          <option value="lifetime">Total (lifetime)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">
          NOVO VALOR (R$)
        </label>
        <VariableAutocomplete
          value={(config.daily_budget as string) || (config.lifetime_budget as string) || ''}
          onChange={(v) => {
            const budgetType = (config.budget_type as string) || 'daily'
            if (budgetType === 'daily') onChange({ ...config, daily_budget: v, lifetime_budget: undefined })
            else onChange({ ...config, lifetime_budget: v, daily_budget: undefined })
          }}
          placeholder="50 ou {{novo_budget}}"
          rows={1}
        />
      </div>
    </>
  )
}

// ─── Boost Post ───────────────────────────────────────────────────────────────

export function BoostPostInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO POST *</label>
        <VariableAutocomplete
          value={(config.post_id as string) || ''}
          onChange={(v) => set('post_id', v)}
          placeholder="{{posts.[0].id}} ou 123456789"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DA PÁGINA DO FACEBOOK *</label>
        <VariableAutocomplete
          value={(config.page_id as string) || ''}
          onChange={(v) => set('page_id', v)}
          placeholder="123456789"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ORÇAMENTO DIÁRIO (R$)</label>
        <VariableAutocomplete
          value={(config.daily_budget as string) || '10'}
          onChange={(v) => set('daily_budget', v)}
          placeholder="10"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">DURAÇÃO (dias)</label>
        <VariableAutocomplete
          value={(config.duration_days as string) || '7'}
          onChange={(v) => set('duration_days', v)}
          placeholder="7"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">SEGMENTAÇÃO (JSON)</label>
        <VariableAutocomplete
          value={typeof config.targeting === 'object' ? JSON.stringify(config.targeting, null, 2) : (config.targeting as string) || '{\n  "geo_locations": {"countries": ["BR"]},\n  "age_min": 18,\n  "age_max": 65\n}'}
          onChange={(v) => set('targeting', v)}
          rows={4}
          className="font-mono"
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{campaign_id}}'}</code></p>
        <p><code className="text-accent">{'{{adset_id}}'}</code></p>
        <p><code className="text-accent">{'{{ad_id}}'}</code></p>
      </div>
    </>
  )
}

// ─── Instagram Posts ──────────────────────────────────────────────────────────

export function InstagramPostsInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const period = (config.period as string) || 'all'

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DA CONTA INSTAGRAM</label>
        <VariableAutocomplete
          value={(config.instagram_account_id as string) || ''}
          onChange={(v) => set('instagram_account_id', v)}
          placeholder="Deixe vazio para usar o do cliente"
          rows={1}
        />
        <p className="text-[10px] text-text3">Se vazio, usa o perfil cadastrado no cliente ou o ID do trigger.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">TIPO DE MÍDIA</label>
        <select
          value={(config.media_type as string) || 'ALL'}
          onChange={(e) => set('media_type', e.target.value === 'ALL' ? '' : e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="ALL">Todos os tipos</option>
          <option value="FEED">Feed (fotos e carrossel)</option>
          <option value="REELS">Reels</option>
          <option value="IMAGE">Apenas fotos</option>
          <option value="CAROUSEL_ALBUM">Apenas carrossel</option>
          <option value="VIDEO">Vídeos</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">PERÍODO</label>
        <select
          value={period}
          onChange={(e) => { set('period', e.target.value); if (e.target.value !== 'custom') { set('date_from', ''); set('date_to', '') } }}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="all">Todos os posts</option>
          <option value="24h">Últimas 24 horas</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
          <option value="this_month">Este mês</option>
          <option value="custom">Período personalizado</option>
        </select>
      </div>

      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">DATA INÍCIO</label>
            <VariableAutocomplete
              value={(config.date_from as string) || ''}
              onChange={(v) => set('date_from', v)}
              placeholder="2024-01-01"
              rows={1}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">DATA FIM</label>
            <VariableAutocomplete
              value={(config.date_to as string) || ''}
              onChange={(v) => set('date_to', v)}
              placeholder="2024-12-31"
              rows={1}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">LIMITE DE POSTS</label>
        <input
          type="number"
          min={1}
          max={100}
          value={(config.limit as number) || 20}
          onChange={(e) => set('limit', parseInt(e.target.value))}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{posts}}'}</code> — array de posts</p>
        <p><code className="text-accent">{'{{posts.[0].id}}'}</code> — ID do post</p>
        <p><code className="text-accent">{'{{posts.[0].caption}}'}</code> — legenda</p>
        <p><code className="text-accent">{'{{posts.[0].media_url}}'}</code> — URL da mídia</p>
        <p><code className="text-accent">{'{{posts.[0].media_type}}'}</code> — tipo (IMAGE/VIDEO/etc)</p>
        <p><code className="text-accent">{'{{posts.[0].timestamp}}'}</code> — data de publicação</p>
        <p><code className="text-accent">{'{{total}}'}</code> — quantidade de posts</p>
      </div>
    </>
  )
}

// ─── Insights por Criativo ────────────────────────────────────────────────────

export function CreativeInsightsInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO ANÚNCIO (opcional)</label>
        <VariableAutocomplete
          value={(config.ad_id as string) || ''}
          onChange={(v) => set('ad_id', v)}
          placeholder="{{ad_id}} — deixe vazio para todos"
          rows={1}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{insights}}'}</code> — array com performance por criativo</p>
        <p><code className="text-accent">{'{{total}}'}</code> — total de criativos</p>
      </div>
    </>
  )
}

// ─── Audiences ────────────────────────────────────────────────────────────────

export function AudiencesInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Busca todos os públicos</p>
        <p>Lista custom audiences e lookalike audiences da conta.</p>
      </div>
      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{publicos}}'}</code> — array de públicos</p>
        <p><code className="text-accent">{'{{total}}'}</code> — total de públicos</p>
      </div>
    </>
  )
}

export function CreateAudienceInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOME DO PÚBLICO *</label>
        <VariableAutocomplete
          value={(config.name as string) || ''}
          onChange={(v) => set('name', v)}
          placeholder="Público {{cliente.nome}} - {{hoje}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">TIPO</label>
        <select
          value={(config.subtype as string) || 'WEBSITE'}
          onChange={(e) => set('subtype', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="WEBSITE">Website (Pixel)</option>
          <option value="APP">App</option>
          <option value="CUSTOM">Lista de clientes</option>
          <option value="LOOKALIKE">Lookalike</option>
        </select>
      </div>

      {(config.subtype as string) === 'WEBSITE' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">ID DO PIXEL</label>
          <VariableAutocomplete
            value={(config.pixel_id as string) || ''}
            onChange={(v) => set('pixel_id', v)}
            placeholder="123456789"
            rows={1}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">DESCRIÇÃO (opcional)</label>
        <VariableAutocomplete
          value={(config.description as string) || ''}
          onChange={(v) => set('description', v)}
          placeholder="Descrição do público"
          rows={2}
        />
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{audience_id}}'}</code> — ID do público criado</p>
      </div>
    </>
  )
}
