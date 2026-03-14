'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clientsApi, type Client, type MetaAccount, type MetaInstagramAccount } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff } from 'lucide-react'

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
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([])
  const [instagramAccounts, setInstagramAccounts] = useState<MetaInstagramAccount[]>([])
  const [loadingInstagram, setLoadingInstagram] = useState(false)

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

  const handleConnectMeta = async () => {
    if (!form.meta_token) {
      error('Insira o token de acesso Meta')
      return
    }
    setConnectingMeta(true)
    try {
      const { accounts } = await clientsApi.connectMeta(
        client?.id || 'new',
        form.meta_token
      )
      setMetaAccounts(accounts)
      setInstagramAccounts([])
      success('Meta conectado com sucesso!')

      // Se já tem conta de anúncios salva, busca os perfis Instagram automaticamente
      const existingAdAccount = form.ad_account_id
      if (existingAdAccount) {
        setLoadingInstagram(true)
        try {
          const { instagram_accounts } = await clientsApi.getInstagramAccounts(
            client?.id || 'new',
            form.meta_token,
            existingAdAccount
          )
          setInstagramAccounts(instagram_accounts)
        } catch {
          setInstagramAccounts([])
        } finally {
          setLoadingInstagram(false)
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao conectar Meta'
      error(msg)
    } finally {
      setConnectingMeta(false)
    }
  }

  const handleAdAccountChange = async (adAccountId: string) => {
    set('ad_account_id', adAccountId)
    set('instagram_account_id', '')
    if (!adAccountId || !form.meta_token) return

    setLoadingInstagram(true)
    try {
      const { instagram_accounts } = await clientsApi.getInstagramAccounts(
        client?.id || 'new',
        form.meta_token,
        adAccountId
      )
      setInstagramAccounts(instagram_accounts)
    } catch {
      setInstagramAccounts([])
    } finally {
      setLoadingInstagram(false)
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

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text2 font-syne">Token de acesso Meta</label>
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
          <Button
            type="button"
            variant="outline"
            onClick={handleConnectMeta}
            loading={connectingMeta}
          >
            Conectar Meta
          </Button>
        </div>
      </div>

      {metaAccounts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text2 font-syne">Conta de anúncios</label>
          <select
            value={form.ad_account_id}
            onChange={(e) => handleAdAccountChange(e.target.value)}
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

      {(instagramAccounts.length > 0 || loadingInstagram) && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text2 font-syne">Perfil Instagram</label>
          {loadingInstagram ? (
            <div className="h-10 rounded-[12px] bg-surface border border-[var(--border)] px-3 flex items-center text-sm text-text3">
              Carregando perfis...
            </div>
          ) : (
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
          )}
        </div>
      )}

      {!instagramAccounts.length && !loadingInstagram && form.instagram_account_id && (
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
