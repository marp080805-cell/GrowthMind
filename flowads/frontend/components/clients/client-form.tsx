'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clientsApi, pagesApi, settingsApi, type Client, type MetaAccount, type MetaInstagramAccount } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ClientFormProps {
  client?: Partial<Client>
  onSuccess: (client: Client) => void
  onCancel: () => void
}

const BUSINESS_TYPES = [
  'E-commerce', 'Delivery', 'Serviços', 'Imobiliário',
  'Saúde', 'Educação', 'Outro',
]

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const { success, error } = useToast()
  const [loading, setLoading] = useState(false)
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([])
  const [instagramAccounts, setInstagramAccounts] = useState<MetaInstagramAccount[]>([])
  const [pages, setPages] = useState<{ id: string; name: string }[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [manualInstagram, setManualInstagram] = useState(false)
  const [hasOwnToken, setHasOwnToken] = useState(!!client?.meta_token)
  const [connectingBM, setConnectingBM] = useState(false)
  const popupRef = useRef<Window | null>(null)

  const [form, setForm] = useState({
    name: client?.name || '',
    business_type: client?.business_type || '',
    whatsapp: client?.whatsapp || '',
    context: client?.context || '',
    ad_account_id: client?.ad_account_id || '',
    instagram_account_id: client?.instagram_account_id || '',
    facebook_page_id: client?.facebook_page_id || '',
  })

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const loadAccounts = (fromClientToken = hasOwnToken) => {
    setLoadingAccounts(true)
    const promise = (client?.id && fromClientToken)
      ? clientsApi.getMetaAccounts(client.id)
      : settingsApi.getMetaAccounts()
    promise
      .then(({ accounts, instagramAccounts: ig }) => {
        setMetaAccounts(accounts)
        setInstagramAccounts(ig || [])
        if (client?.instagram_account_id && !(ig || []).some(a => a.id === client.instagram_account_id)) {
          setManualInstagram(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAccounts(false))
  }

  // Load Meta accounts — usa token próprio do cliente se tiver, senão token global
  useEffect(() => { loadAccounts() }, [])

  const connectBM = () => {
    if (!client?.id) return
    setConnectingBM(true)
    const oauthUrl = `${API_URL}/auth/meta/connect?type=client&client_id=${client.id}`
    popupRef.current = window.open(oauthUrl, 'meta_bm_oauth', 'width=600,height=700,left=200,top=100')

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'meta_connected' && e.data?.client_id === client.id) {
        window.removeEventListener('message', handleMessage)
        setHasOwnToken(true)
        setConnectingBM(false)
        loadAccounts(true)
        success('BM separada conectada com sucesso!')
      } else if (e.data?.type === 'meta_error') {
        window.removeEventListener('message', handleMessage)
        setConnectingBM(false)
        error(e.data.error || 'Erro ao conectar BM')
      }
    }
    window.addEventListener('message', handleMessage)
  }

  const disconnectBM = async () => {
    if (!client?.id) return
    try {
      await clientsApi.update(client.id, { meta_token: null } as never)
      setHasOwnToken(false)
      loadAccounts(false)
      success('BM separada desconectada. Usando token global.')
    } catch {
      error('Erro ao desconectar BM')
    }
  }

  // Load Facebook Pages — via client if editing, via settings otherwise
  useEffect(() => {
    const loadPages = client?.id
      ? pagesApi.list(client.id)
      : pagesApi.listFromSettings()
    loadPages.then(res => setPages(res.pages)).catch(() => {})
  }, [client?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { error('Nome é obrigatório'); return }
    setLoading(true)
    try {
      const data = client?.id
        ? await clientsApi.update(client.id, form)
        : await clientsApi.create(form)
      success(client?.id ? 'Cliente atualizado!' : 'Cliente criado!')
      onSuccess(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar cliente'
      error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nome *"
        placeholder="Nome do cliente"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text2 font-syne">Tipo de negócio</label>
        <select
          value={form.business_type}
          onChange={(e) => set('business_type', e.target.value)}
          className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">Selecione...</option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <Input
        label="WhatsApp"
        placeholder="(99) 99999-9999"
        value={form.whatsapp}
        onChange={(e) => set('whatsapp', e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text2 font-syne">Contexto do cliente</label>
        <textarea
          value={form.context}
          onChange={(e) => set('context', e.target.value)}
          placeholder="Descreva o negócio, tom de voz, diferenciais, público-alvo, produtos principais... Este campo é injetado automaticamente em todos os agentes de IA deste cliente."
          rows={4}
          className="rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-text3"
        />
      </div>

      {/* BM separada — só exibe ao editar cliente existente */}
      {client?.id && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text2 font-syne">Business Manager</label>
          {hasOwnToken ? (
            <div className="flex items-center justify-between rounded-[12px] bg-surface border border-[var(--border)] px-3 h-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span className="text-sm text-text">BM própria conectada</span>
              </div>
              <button
                type="button"
                onClick={disconnectBM}
                className="text-xs text-text3 hover:text-red-400 transition-colors"
              >
                Desconectar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-[12px] bg-surface border border-[var(--border)] px-3 h-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-text3 inline-block" />
                <span className="text-sm text-text3">Usando token global (Configurações)</span>
              </div>
              <button
                type="button"
                onClick={connectBM}
                disabled={connectingBM}
                className="text-xs text-accent hover:underline disabled:opacity-50 transition-colors"
              >
                {connectingBM ? 'Conectando...' : 'Conectar BM separada'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Conta de anúncios */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text2 font-syne">Conta de anúncios</label>
        {loadingAccounts ? (
          <div className="h-10 rounded-[12px] bg-surface border border-[var(--border)] animate-pulse" />
        ) : metaAccounts.length > 0 ? (
          <select
            value={form.ad_account_id}
            onChange={(e) => set('ad_account_id', e.target.value)}
            className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent transition-colors"
          >
            <option value="">Selecione a conta...</option>
            {metaAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name} ({acc.id})</option>
            ))}
          </select>
        ) : (
          <Input
            placeholder="act_xxxxxxxxxx"
            value={form.ad_account_id}
            onChange={(e) => set('ad_account_id', e.target.value)}
          />
        )}
      </div>

      {/* Perfil Instagram */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text2 font-syne">Perfil Instagram</label>
        {loadingAccounts ? (
          <div className="h-10 rounded-[12px] bg-surface border border-[var(--border)] animate-pulse" />
        ) : instagramAccounts.length > 0 ? (
          <>
            {!manualInstagram ? (
              <select
                value={form.instagram_account_id}
                onChange={(e) => {
                  if (e.target.value === '__manual__') { setManualInstagram(true); set('instagram_account_id', ''); return }
                  set('instagram_account_id', e.target.value)
                }}
                className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">Selecione o perfil...</option>
                {instagramAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.username} — {acc.name} ({acc.id})
                  </option>
                ))}
                <option value="__manual__">✏️ Inserir ID manualmente...</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="ID da conta Instagram (ex: 17841400246605440)"
                  value={form.instagram_account_id}
                  onChange={(e) => set('instagram_account_id', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => { setManualInstagram(false); set('instagram_account_id', '') }}
                  className="text-xs text-text3 hover:text-text2 underline whitespace-nowrap"
                >
                  Ver lista
                </button>
              </div>
            )}
          </>
        ) : (
          <Input
            placeholder="123456789"
            value={form.instagram_account_id}
            onChange={(e) => set('instagram_account_id', e.target.value)}
          />
        )}
        {!loadingAccounts && metaAccounts.length === 0 && instagramAccounts.length === 0 && (
          <p className="text-xs text-text3">
            Conecte sua conta Meta em <a href="/settings" className="text-accent hover:underline">Configurações</a> para ver as opções disponíveis.
          </p>
        )}
      </div>

      {/* Página do Facebook */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text2 font-syne">Página do Facebook</label>
        {pages.length > 0 ? (
          <select
            value={form.facebook_page_id}
            onChange={(e) => set('facebook_page_id', e.target.value)}
            className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent transition-colors"
          >
            <option value="">Selecione a página...</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
            ))}
          </select>
        ) : (
          <Input
            placeholder="ID da página do Facebook (ex: 123456789)"
            value={form.facebook_page_id}
            onChange={(e) => set('facebook_page_id', e.target.value)}
          />
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {client?.id ? 'Salvar alterações' : 'Criar cliente'}
        </Button>
      </div>
    </form>
  )
}
