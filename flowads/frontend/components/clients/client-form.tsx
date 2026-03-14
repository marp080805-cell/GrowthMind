'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clientsApi, type Client, type MetaAccount, type MetaInstagramAccount } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff, ChevronDown, RefreshCw } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/backend'

interface ClientFormProps {
  client?: Partial<Client>
  onSuccess: (client: Client) => void
  onCancel: () => void
  autoLoadMeta?: boolean
}

const BUSINESS_TYPES = [
  'E-commerce', 'Delivery', 'Serviços', 'Imobiliário',
  'Saúde', 'Educação', 'Outro',
]

export function ClientForm({ client, onSuccess, onCancel, autoLoadMeta }: ClientFormProps) {
  const { success, error } = useToast()
  const [loading, setLoading] = useState(false)
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [showManualToken, setShowManualToken] = useState(false)
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([])
  const [instagramAccounts, setInstagramAccounts] = useState<MetaInstagramAccount[]>([])

  useEffect(() => {
    if (client?.id && autoLoadMeta) {
      loadMetaAccounts()
    }
  }, [client?.id, autoLoadMeta]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMetaAccounts = async () => {
    if (!client?.id) return
    setLoadingAccounts(true)
    try {
      const { accounts, instagramAccounts: igAccounts } = await clientsApi.getMetaAccounts(client.id)
      setMetaAccounts(accounts)
      setInstagramAccounts(igAccounts || [])
    } catch {
      // silently fail — client may not have meta connected yet
    } finally {
      setLoadingAccounts(false)
    }
  }


  const [form, setForm] = useState({
    name: client?.name || '',
    business_type: client?.business_type || '',
    whatsapp: client?.whatsapp || '',
    context: client?.context || '',
    meta_token: '',
    ad_account_id: client?.ad_account_id || '',
    instagram_account_id: client?.instagram_account_id || '',
  })

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleConnectOAuth = async () => {
    if (!client?.id) {
      // Novo cliente: salva primeiro para ter um ID
      if (!form.name) { error('Preencha o nome do cliente antes de conectar'); return }
      setLoading(true)
      try {
        const created = await clientsApi.create(form)
        window.location.href = `${API_URL}/auth/meta/connect?client_id=${created.id}`
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro ao salvar cliente'
        error(msg)
        setLoading(false)
      }
      return
    }
    window.location.href = `${API_URL}/auth/meta/connect?client_id=${client.id}`
  }

  const handleConnectMeta = async () => {
    if (!form.meta_token) {
      error('Insira o token de acesso Meta')
      return
    }
    setConnectingMeta(true)
    try {
      const { accounts, instagramAccounts } = await clientsApi.connectMeta(
        client?.id || 'new',
        form.meta_token
      )
      setMetaAccounts(accounts)
      setInstagramAccounts(instagramAccounts || [])
      success('Meta conectado com sucesso!')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao conectar Meta'
      error(msg)
    } finally {
      setConnectingMeta(false)
    }
  }


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

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text2 font-syne">Conexão Meta</label>

        {/* Botão OAuth principal */}
        <button
          type="button"
          onClick={handleConnectOAuth}
          disabled={loading}
          className="flex items-center justify-center gap-2.5 h-10 w-full rounded-[12px] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: '#1877F2' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          {loading ? 'Salvando...' : 'Conectar com Facebook'}
        </button>

        {/* Recarregar contas (só aparece para clientes já conectados) */}
        {client?.id && (
          <button
            type="button"
            onClick={loadMetaAccounts}
            disabled={loadingAccounts}
            className="flex items-center gap-1.5 text-xs text-text3 hover:text-text2 transition-colors self-start"
          >
            <RefreshCw size={13} className={loadingAccounts ? 'animate-spin' : ''} />
            {loadingAccounts ? 'Carregando contas...' : 'Recarregar contas Meta'}
          </button>
        )}

        {/* Opção manual colapsável */}
        <button
          type="button"
          onClick={() => setShowManualToken(!showManualToken)}
          className="flex items-center gap-1 text-xs text-text3 hover:text-text2 transition-colors self-start"
        >
          <ChevronDown size={13} className={`transition-transform ${showManualToken ? 'rotate-180' : ''}`} />
          Inserir token manualmente
        </button>

        {showManualToken && (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="EAAxxxxxxxxxxxx..."
                value={form.meta_token}
                onChange={(e) => set('meta_token', e.target.value)}
                className="w-full h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 pr-10 text-sm focus:outline-none focus:border-accent transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text2 transition-colors"
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Button type="button" variant="outline" onClick={handleConnectMeta} loading={connectingMeta}>
              Conectar
            </Button>
          </div>
        )}
      </div>

      {metaAccounts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text2 font-syne">Conta de anúncios</label>
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
        </div>
      )}

      {!metaAccounts.length && form.ad_account_id && (
        <Input
          label="ID da conta de anúncios"
          placeholder="act_xxxxxxxxxx"
          value={form.ad_account_id}
          onChange={(e) => set('ad_account_id', e.target.value)}
        />
      )}

      {instagramAccounts.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text2 font-syne">Perfil Instagram</label>
          <select
            value={form.instagram_account_id}
            onChange={(e) => set('instagram_account_id', e.target.value)}
            className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent transition-colors"
          >
            <option value="">Selecione o perfil...</option>
            {instagramAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                @{acc.username} — {acc.name} ({acc.id})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <Input
          label="ID da conta Instagram"
          placeholder="123456789"
          value={form.instagram_account_id}
          onChange={(e) => set('instagram_account_id', e.target.value)}
        />
      )}

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
