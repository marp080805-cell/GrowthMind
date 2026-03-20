'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'
import { campaignsApi, adsetsApi, pagesApi, type Campaign, type AdSet } from '@/lib/api'

const CTA_OPTIONS: { value: string; label: string }[] = [
  { value: 'NO_BUTTON', label: 'Sem botão' },
  { value: 'SHOP_NOW', label: 'Comprar agora' },
  { value: 'LEARN_MORE', label: 'Saiba mais' },
  { value: 'SIGN_UP', label: 'Cadastre-se' },
  { value: 'CONTACT_US', label: 'Fale conosco' },
  { value: 'BOOK_NOW', label: 'Reserve agora' },
  { value: 'DOWNLOAD', label: 'Baixar' },
  { value: 'GET_OFFER', label: 'Pegar oferta' },
  { value: 'WATCH_MORE', label: 'Ver mais' },
  { value: 'SEND_MESSAGE', label: 'Enviar mensagem' },
  { value: 'SUBSCRIBE', label: 'Assinar' },
  { value: 'GET_QUOTE', label: 'Pedir orçamento' },
  { value: 'REQUEST_TIME', label: 'Agendar horário' },
  { value: 'APPLY_NOW', label: 'Candidatar-se' },
  { value: 'BUY_NOW', label: 'Comprar' },
  { value: 'ORDER_NOW', label: 'Pedir agora' },
]

export function FetchAdsInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const params = useParams<{ id?: string }>()
  const clientId = params?.id
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adsets, setAdsets] = useState<AdSet[]>([])
  const [loadingAdsets, setLoadingAdsets] = useState(false)
  const [campaignForAdsets, setCampaignForAdsets] = useState('')

  const parentType = (config.parent_type as string) || 'account'

  useEffect(() => {
    if (clientId) {
      campaignsApi.list(clientId).then(setCampaigns).catch(() => {})
    }
  }, [clientId])

  useEffect(() => {
    if (clientId && parentType === 'adset' && campaignForAdsets) {
      setLoadingAdsets(true)
      setAdsets([])
      adsetsApi.list(clientId, campaignForAdsets)
        .then(setAdsets)
        .catch(() => {})
        .finally(() => setLoadingAdsets(false))
    } else {
      setAdsets([])
    }
  }, [clientId, parentType, campaignForAdsets])

  const selectClass = "h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent w-full"

  return (
    <>
      <div className="flex gap-2">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-syne font-semibold text-text3">NÍVEL</label>
          <select
            value={parentType}
            onChange={(e) => onChange({ ...config, parent_type: e.target.value, parent_id: '' })}
            className={selectClass}
          >
            <option value="account">Conta inteira</option>
            <option value="campaign">Por campanha</option>
            <option value="adset">Por conjunto</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-syne font-semibold text-text3">STATUS</label>
          <select
            value={(config.status_filter as string) || 'ACTIVE'}
            onChange={(e) => set('status_filter', e.target.value)}
            className={selectClass}
          >
            <option value="ACTIVE">Ativos</option>
            <option value="PAUSED">Pausados</option>
            <option value="ALL">Todos</option>
          </select>
        </div>
      </div>

      {parentType === 'campaign' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">CAMPANHA</label>
          {campaigns.length > 0 ? (
            <select
              value={(config.parent_id as string) || ''}
              onChange={(e) => set('parent_id', e.target.value)}
              className={selectClass}
            >
              <option value="">Selecione a campanha...</option>
              {campaigns.map((c) => (
                <option key={c.meta_campaign_id} value={c.meta_campaign_id}>
                  {c.name} {c.status !== 'ACTIVE' ? `(${c.status})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <VariableAutocomplete
              value={(config.parent_id as string) || ''}
              onChange={(v) => set('parent_id', v)}
              placeholder="{{campaign_id}} ou ID da campanha"
              rows={1}
            />
          )}
          {!campaigns.length && (
            <p className="text-[10px] text-text3">Sincronize campanhas na aba do cliente para ver aqui.</p>
          )}
        </div>
      )}

      {parentType === 'adset' && (
        <>
          {campaigns.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-syne font-semibold text-text3">CAMPANHA (filtro para carregar conjuntos)</label>
              <select
                value={campaignForAdsets}
                onChange={(e) => setCampaignForAdsets(e.target.value)}
                className={selectClass}
              >
                <option value="">Selecione para listar conjuntos...</option>
                {campaigns.map((c) => (
                  <option key={c.meta_campaign_id} value={c.meta_campaign_id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">CONJUNTO DE ANÚNCIOS</label>
            {loadingAdsets ? (
              <div className="text-[10px] text-text3 py-1">Carregando conjuntos...</div>
            ) : adsets.length > 0 ? (
              <select
                value={(config.parent_id as string) || ''}
                onChange={(e) => set('parent_id', e.target.value)}
                className={selectClass}
              >
                <option value="">Selecione o conjunto...</option>
                {adsets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            ) : (
              <VariableAutocomplete
                value={(config.parent_id as string) || ''}
                onChange={(v) => set('parent_id', v)}
                placeholder="{{adset_id}} ou ID do conjunto"
                rows={1}
              />
            )}
          </div>
        </>
      )}

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{anuncios}}'}</code> — array de anúncios</p>
        <p><code className="text-accent">{'{{total}}'}</code> — total de anúncios</p>
      </div>
    </>
  )
}

export function CreateAdInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const useExistingCreative = (config.creative_type === 'existing') || (!config.creative_type && !!(config.creative_id as string))
  const params = useParams<{ id?: string }>()
  const clientId = params?.id
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adsets, setAdsets] = useState<AdSet[]>([])
  const [loadingAdsets, setLoadingAdsets] = useState(false)
  const [pages, setPages] = useState<{ id: string; name: string }[]>([])
  const selectedCampaignId = (config.campaign_id as string) || ''
  const selectedAdsetId = (config.adset_id as string) || ''

  useEffect(() => {
    if (clientId) {
      campaignsApi.list(clientId).then(setCampaigns).catch(() => {})
    }
  }, [clientId])

  useEffect(() => {
    if (clientId) {
      pagesApi.list(clientId).then(res => setPages(res.pages)).catch(() => {})
    }
  }, [clientId])

  useEffect(() => {
    if (clientId && selectedCampaignId) {
      setLoadingAdsets(true)
      setAdsets([])
      adsetsApi.list(clientId, selectedCampaignId)
        .then(setAdsets)
        .catch(() => {})
        .finally(() => setLoadingAdsets(false))
    } else {
      setAdsets([])
    }
  }, [clientId, selectedCampaignId])

  const selectClass = "h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
  const inputClass = "h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent w-full"

  return (
    <>
      {/* Campaign dropdown */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">CAMPANHA *</label>
        {campaigns.length > 0 ? (
          <select
            value={selectedCampaignId}
            onChange={(e) => onChange({ ...config, campaign_id: e.target.value, adset_id: '' })}
            className={selectClass}
          >
            <option value="">Selecione a campanha...</option>
            {campaigns.map((c) => (
              <option key={c.meta_campaign_id} value={c.meta_campaign_id}>
                {c.name} {c.status !== 'ACTIVE' ? `(${c.status})` : ''}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder="{{campaign_id}} ou ID da campanha"
            value={selectedCampaignId}
            onChange={(e) => onChange({ ...config, campaign_id: e.target.value, adset_id: '' })}
            className={inputClass}
          />
        )}
        {!campaigns.length && (
          <p className="text-[10px] text-text3">Sincronize campanhas na aba do cliente para selecionar pelo nome.</p>
        )}
      </div>

      {/* Adset dropdown */}
      {selectedCampaignId && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">CONJUNTO DE ANÚNCIOS *</label>
          {loadingAdsets ? (
            <div className={`${inputClass} flex items-center text-text3`}>Carregando conjuntos...</div>
          ) : adsets.length > 0 ? (
            <select
              value={selectedAdsetId}
              onChange={(e) => set('adset_id', e.target.value)}
              className={selectClass}
            >
              <option value="">Selecione o conjunto...</option>
              {adsets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.status !== 'ACTIVE' ? `(${a.status})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="{{adset_id}} ou ID do conjunto"
              value={selectedAdsetId}
              onChange={(e) => set('adset_id', e.target.value)}
              className={inputClass}
            />
          )}
        </div>
      )}
      {!selectedCampaignId && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">CONJUNTO DE ANÚNCIOS *</label>
          <VariableAutocomplete
            value={selectedAdsetId}
            onChange={(v) => set('adset_id', v)}
            placeholder="{{adset_id}} — selecione uma campanha acima"
            rows={1}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOME DO ANÚNCIO *</label>
        <VariableAutocomplete
          value={(config.name as string) || ''}
          onChange={(v) => set('name', v)}
          placeholder="Anúncio principal - {{hoje}}"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">TIPO DE CRIATIVO</label>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { value: 'instagram_post', label: '📸 Post Instagram' },
            { value: 'new', label: 'Criar novo' },
            { value: 'existing', label: 'ID existente' },
            { value: 'uploaded', label: '🖼️ Upload criativo' },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                if (t.value === 'existing') onChange({ ...config, creative_type: 'existing', source_instagram_media_id: undefined })
                else if (t.value === 'instagram_post') onChange({ ...config, creative_type: 'instagram_post', creative_id: undefined })
                else if (t.value === 'uploaded') onChange({ ...config, creative_type: 'uploaded', creative_id: undefined, source_instagram_media_id: undefined })
                else onChange({ ...config, creative_type: 'new', creative_id: undefined, source_instagram_media_id: undefined })
              }}
              className={`flex-1 h-8 rounded-[8px] text-xs font-syne font-bold transition-colors border ${
                (config.creative_type || 'new') === t.value
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-surface text-text3 border-[var(--border)] hover:border-[var(--border2)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {(config.creative_type || 'new') === 'instagram_post' ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">ID DO POST INSTAGRAM *</label>
            <VariableAutocomplete
              value={(config.source_instagram_media_id as string) || ''}
              onChange={(v) => set('source_instagram_media_id', v)}
              placeholder="{{posts.[0].id}} ou ID do post"
              rows={1}
            />
            <p className="text-[10px] text-text3">Use a variável do bloco anterior ou cole o ID do post diretamente.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">PÁGINA DO FACEBOOK *</label>
            {pages.length > 0 ? (
              <select
                value={(config.page_id as string) || ''}
                onChange={(e) => set('page_id', e.target.value)}
                className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
              >
                <option value="">Selecione a página...</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ) : (
              <VariableAutocomplete
                value={(config.page_id as string) || ''}
                onChange={(v) => set('page_id', v)}
                placeholder="Ex: 123456789"
                rows={1}
              />
            )}
            <p className="text-[10px] text-text3">Deixe vazio para usar a página do cliente.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">ID DA CONTA INSTAGRAM (opcional)</label>
            <VariableAutocomplete
              value={(config.instagram_actor_id as string) || ''}
              onChange={(v) => set('instagram_actor_id', v)}
              placeholder="Deixe vazio para usar o do cliente"
              rows={1}
            />
          </div>
          <div className="bg-blue-500/5 rounded-[8px] p-2.5 border border-blue-500/10 text-[10px] text-text3">
            <p className="font-syne font-bold text-blue-400 mb-1">Como funciona</p>
            <p>Cria um anúncio promovendo um post existente do Instagram. Requer o ID da Página do Facebook vinculada à conta Instagram (campo <code>object_id</code> da API Meta).</p>
          </div>
        </>
      ) : config.creative_type === 'uploaded' ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">ID DA PÁGINA DO FACEBOOK *</label>
            {pages.length > 0 ? (
              <select
                value={(config.page_id as string) || ''}
                onChange={(e) => set('page_id', e.target.value)}
                className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
              >
                <option value="">Selecione a página...</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ) : (
              <VariableAutocomplete
                value={(config.page_id as string) || ''}
                onChange={(v) => set('page_id', v)}
                placeholder="123456789"
                rows={1}
              />
            )}
            <p className="text-[10px] text-text3">Deixe vazio para usar a página do cliente.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">HASH DA IMAGEM ou ID DO VÍDEO *</label>
            <VariableAutocomplete
              value={(config.image_hash as string) || (config.video_id as string) || ''}
              onChange={(v) => {
                // Detecta se é video_id (numérico) ou image_hash (alfanumérico com letras)
                const isVideoId = /^\d+$/.test(v) || v.startsWith('{{')
                if (!v.startsWith('{{') && /^\d+$/.test(v)) {
                  onChange({ ...config, video_id: v, image_hash: undefined })
                } else {
                  onChange({ ...config, image_hash: v, video_id: undefined })
                }
              }}
              placeholder="{{image_hash}} ou {{video_id}}"
              rows={1}
            />
            <p className="text-[10px] text-text3">Use a saída do bloco <strong>Upload criativo</strong>: <code className="text-accent">{'{{image_hash}}'}</code> para imagens ou <code className="text-accent">{'{{video_id}}'}</code> para vídeos.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">TÍTULO</label>
            <VariableAutocomplete value={(config.title as string) || ''} onChange={(v) => set('title', v)} placeholder="Título do anúncio" rows={1} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">TEXTO DO ANÚNCIO</label>
            <VariableAutocomplete value={(config.body as string) || ''} onChange={(v) => set('body', v)} placeholder="Texto principal..." rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">URL DE DESTINO</label>
            <VariableAutocomplete value={(config.link_url as string) || ''} onChange={(v) => set('link_url', v)} placeholder="https://seusite.com.br" rows={1} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">CALL TO ACTION</label>
            <select value={(config.call_to_action as string) || 'LEARN_MORE'} onChange={(e) => set('call_to_action', e.target.value)} className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent">
              {CTA_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">ID DO INSTAGRAM (opcional)</label>
            <VariableAutocomplete value={(config.instagram_actor_id as string) || ''} onChange={(v) => set('instagram_actor_id', v)} placeholder="Deixe vazio para usar o do cliente" rows={1} />
          </div>
        </>
      ) : useExistingCreative ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">ID DO CRIATIVO *</label>
          <VariableAutocomplete
            value={(config.creative_id as string) || ''}
            onChange={(v) => set('creative_id', v)}
            placeholder="{{creative_id}} ou 123456789"
            rows={1}
          />
        </div>
      ) : (
        <>
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
            <label className="text-[10px] font-syne font-semibold text-text3">TIPO DE MÍDIA</label>
            <select
              value={(config.media_type as string) || 'image'}
              onChange={(e) => set('media_type', e.target.value)}
              className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
            >
              <option value="image">Imagem</option>
              <option value="video">Vídeo</option>
            </select>
          </div>

          {(config.media_type || 'image') === 'image' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-syne font-semibold text-text3">URL DA IMAGEM *</label>
              <VariableAutocomplete
                value={(config.image_url as string) || ''}
                onChange={(v) => set('image_url', v)}
                placeholder="https://... ou {{imagem_url}}"
                rows={1}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-syne font-semibold text-text3">ID DO VÍDEO *</label>
              <VariableAutocomplete
                value={(config.video_id as string) || ''}
                onChange={(v) => set('video_id', v)}
                placeholder="{{video_id}} ou 123456789"
                rows={1}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">TÍTULO</label>
            <VariableAutocomplete
              value={(config.title as string) || ''}
              onChange={(v) => set('title', v)}
              placeholder="Título do anúncio {{cliente.nome}}"
              rows={1}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">TEXTO DO ANÚNCIO</label>
            <VariableAutocomplete
              value={(config.body as string) || ''}
              onChange={(v) => set('body', v)}
              placeholder="Texto principal do anúncio..."
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">URL DE DESTINO</label>
            <VariableAutocomplete
              value={(config.link_url as string) || ''}
              onChange={(v) => set('link_url', v)}
              placeholder="https://seusite.com.br"
              rows={1}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">CALL TO ACTION</label>
            <select
              value={(config.call_to_action as string) || 'LEARN_MORE'}
              onChange={(e) => set('call_to_action', e.target.value)}
              className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
            >
              {CTA_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-syne font-semibold text-text3">ID DO INSTAGRAM (opcional)</label>
            <VariableAutocomplete
              value={(config.instagram_actor_id as string) || ''}
              onChange={(v) => set('instagram_actor_id', v)}
              placeholder="ID da conta Instagram"
              rows={1}
            />
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">STATUS INICIAL</label>
        <select
          value={(config.status as string) || 'PAUSED'}
          onChange={(e) => set('status', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="PAUSED">Pausado</option>
          <option value="ACTIVE">Ativo</option>
        </select>
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Saída disponível</p>
        <p><code className="text-accent">{'{{ad_id}}'}</code> — ID do anúncio criado</p>
      </div>
    </>
  )
}

export function EditAdInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO ANÚNCIO *</label>
        <VariableAutocomplete
          value={(config.ad_id as string) || ''}
          onChange={(v) => set('ad_id', v)}
          placeholder="{{ad_id}} ou 123456789"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">NOVO NOME (opcional)</label>
        <VariableAutocomplete
          value={(config.name as string) || ''}
          onChange={(v) => set('name', v)}
          placeholder="Novo nome"
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">STATUS</label>
        <select
          value={(config.status as string) || ''}
          onChange={(e) => set('status', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="">Não alterar</option>
          <option value="ACTIVE">Ativar</option>
          <option value="PAUSED">Pausar</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">ID DO NOVO CRIATIVO (opcional)</label>
        <VariableAutocomplete
          value={(config.creative_id as string) || ''}
          onChange={(v) => set('creative_id', v)}
          placeholder="{{creative_id}}"
          rows={1}
        />
      </div>
    </>
  )
}
