'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clientsApi, pagesApi, settingsApi, type Client, type MetaAccount, type MetaInstagramAccount } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Copy, Link } from 'lucide-react'

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
  const [showManualToken, setShowManualToken] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [savingToken, setSavingToken] = useState(false)
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

  const copyBMLink = async () => {
    if (!client?.id) return
    try {
      const res = await fetch(`${API_URL}/auth/meta/connect?type=client&client_id=${client.id}&format=url`)
      const { url } = await res.json() as { url: string }
      await navigator.clipboard.writeText(url)
      success('Link copiado! Cole no navegador onde o Facebook está logado.')
    } catch {
      error('Erro ao gerar link')
    }
  }

  const saveManualTokenBM = async () => {
    if (!client?.id || !manualToken.trim()) { error('Cole o token antes de salvar'); return }
    setSavingToken(true)
    try {
      const res = await fetch(`${API_URL}/auth/meta/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: manualToken.trim(), type: 'client', client_id: client.id }),
        credentials: 'include',
      })
      const data = await res.json() as { ok?: boolean; message?: string }
      if (!res.ok) throw new Error(data.message || 'Erro ao salvar token')
      setManualToken('')
      setShowManualToken(false)
      setHasOwnToken(true)
      loadAccounts(true)
      success('Token salvo com sucesso!')
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro ao salvar token')
    } finally {
      setSavingToken(false)
    }
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
            <div className="flex items-center justify-between rounded-[12px] bg-green-500/10 border border-green-500/20 px-3 h-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span className="text-sm text-text">BM própria conectada</span>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={connectBM} className="text-xs text-text3 hover:text-text2 underline transition-colors">
                  Reconectar
                </button>
                <button type="button" onClick={disconnectBM} className="text-xs text-red-400 hover:text-red-300 underline transition-colors">
                  Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-text3">Conecte uma BM separada para usar o token desta BM em vez do token global das Configurações.</p>
              <button
                type="button"
                onClick={connectBM}
                disabled={connectingBM}
                className="flex items-center justify-center gap-2.5 h-10 w-full rounded-[12px] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#1877F2' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {connectingBM ? 'Conectando...' : 'Conectar com Facebook'}
              </button>
              <button
                type="button"
                onClick={copyBMLink}
                className="flex items-center justify-center gap-2 h-9 w-full rounded-[12px] text-text3 text-xs font-medium border border-[var(--border)] hover:text-text2 hover:border-accent transition-colors"
              >
                <Copy size={13} />
                Copiar link (para colar em outro navegador)
              </button>
              <button
                type="button"
                onClick={() => setShowManualToken(v => !v)}
                className="flex items-center justify-center gap-2 h-9 w-full rounded-[12px] text-text3 text-xs font-medium border border-[var(--border)] hover:text-text2 hover:border-accent transition-colors"
              >
                <Link size={13} />
                Inserir token manualmente (System User / Graph API Explorer)
              </button>
              {showManualToken && (
                <div className="space-y-2 p-3 rounded-[12px] bg-surface border border-[var(--border)]">
                  <p className="text-xs text-text3">
                    Gere o token em <span className="text-accent font-medium">developers.facebook.com/tools/explorer</span> ou use um System User da BM → cole abaixo.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder="Cole o token aqui..."
                      className="flex-1 h-9 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent transition-colors"
                    />
                    <Button size="sm" type="button" onClick={saveManualTokenBM} loading={savingToken}>
                      Salvar
                    </Button>
                  </div>
                </div>
              )}
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
