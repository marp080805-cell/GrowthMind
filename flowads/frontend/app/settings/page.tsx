'use client'

import { useState, useEffect } from 'react'
import { Shell } from '@/components/layout/shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Toggle } from '@/components/ui/toggle'
import { settingsApi, type Settings, type AIModel } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import {
  CheckCircle, XCircle, Eye, EyeOff, Plus, Trash2,
  Save, RefreshCw, Copy, Link
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/backend'

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error'

function SettingsPageInner() {
  const { success, error } = useToast()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<Record<string, ConnectionStatus>>({})
  const [models, setModels] = useState<AIModel[]>([])
  const [showAddModel, setShowAddModel] = useState(false)
  const [newModel, setNewModel] = useState({ provider: 'openai' as 'openai' | 'anthropic', slug: '', display_name: '' })
  useEffect(() => {
    Promise.all([settingsApi.get(), settingsApi.getModels()])
      .then(([s, m]) => { setSettings(s); setModels(m) })
      .catch(() => error('Erro ao carregar configurações'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: keyof Settings, value: string) =>
    setSettings((prev) => prev ? { ...prev, [key]: value } : null)

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await settingsApi.update(settings)
      setSettings(updated)
      success('Configurações salvas!')
    } catch {
      error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async (service: string) => {
    setStatus((s) => ({ ...s, [service]: 'testing' }))
    try {
      const { ok, message } = await settingsApi.test(service, settings ?? undefined)
      setStatus((s) => ({ ...s, [service]: ok ? 'ok' : 'error' }))
      if (ok) success(message || `${service} conectado!`)
      else error(message || `Falha ao conectar ${service}`)
    } catch {
      setStatus((s) => ({ ...s, [service]: 'error' }))
      error(`Erro ao testar ${service}`)
    }
  }

  const toggleModel = async (modelId: string, active: boolean) => {
    const updated = models.map((m) => m.id === modelId ? { ...m, is_active: active } : m)
    setModels(updated)
    await settingsApi.updateModels(updated)
  }

  const addModel = async () => {
    if (!newModel.slug || !newModel.display_name) { error('Preencha todos os campos'); return }
    const model: AIModel = { ...newModel, id: `custom-${Date.now()}`, is_active: true }
    const updated = [...models, model]
    setModels(updated)
    await settingsApi.updateModels(updated)
    success('Modelo adicionado!')
    setShowAddModel(false)
    setNewModel({ provider: 'openai', slug: '', display_name: '' })
  }

  const deleteModel = async (id: string) => {
    const updated = models.filter((m) => m.id !== id)
    setModels(updated)
    await settingsApi.updateModels(updated)
  }

  const StatusIcon = ({ service }: { service: string }) => {
    const s = status[service]
    if (s === 'ok') return <CheckCircle size={16} className="text-green" />
    if (s === 'error') return <XCircle size={16} className="text-red" />
    if (s === 'testing') return <RefreshCw size={16} className="text-yellow animate-spin" />
    return null
  }

  if (loading || !settings) {
    return (
      <Shell title="Configurações">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </Shell>
    )
  }

  const isMetaConnected = !!settings.meta_token

  const openMetaOAuth = () => {
    const popup = window.open(
      `${API_URL}/auth/meta/connect?type=settings`,
      'meta_oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    )
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'meta_connected') {
        window.removeEventListener('message', onMessage)
        popup?.close()
        settingsApi.get().then(setSettings).catch(() => {})
        success('Meta conectado com sucesso!')
      }
    }
    window.addEventListener('message', onMessage)
    const interval = setInterval(() => {
      if (popup?.closed) {
        clearInterval(interval)
        window.removeEventListener('message', onMessage)
        settingsApi.get().then(setSettings).catch(() => {})
      }
    }, 1000)
  }

  const copyMetaOAuthLink = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/meta/connect?type=settings&format=url`)
      const { url } = await res.json() as { url: string }
      await navigator.clipboard.writeText(url)
      success('Link copiado! Cole no navegador onde o Facebook está logado.')
    } catch {
      error('Erro ao gerar link')
    }
  }

  const otherIntegrations = [
    {
      id: 'whatsapp',
      title: 'WhatsApp API',
      icon: '💬',
      fields: [
        { key: 'whatsapp_url', label: 'URL base da API', type: 'text' },
        { key: 'whatsapp_instance', label: 'Nome da instância', type: 'text' },
        { key: 'whatsapp_token', label: 'Token de autenticação', type: 'password' },
        { key: 'whatsapp_number', label: 'Número padrão', type: 'text' },
      ],
    },
    {
      id: 'openai',
      title: 'OpenAI',
      icon: '🤖',
      fields: [{ key: 'openai_key', label: 'API Key', type: 'password' }],
    },
    {
      id: 'anthropic',
      title: 'Anthropic / Claude',
      icon: '🧠',
      fields: [{ key: 'anthropic_key', label: 'API Key', type: 'password' }],
    },
  ]

  return (
    <Shell
      title="Configurações"
      actions={
        <Button size="sm" onClick={handleSave} loading={saving}>
          <Save size={14} />
          Salvar tudo
        </Button>
      }
    >
      <div className="space-y-5 max-w-2xl">
        {/* Meta API — OAuth */}
        <div className="bg-surface border border-[var(--border)] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">📘</span>
              <h3 className="font-syne font-semibold text-text">Meta API</h3>
              {isMetaConnected && <CheckCircle size={15} className="text-green-500" />}
            </div>
            {isMetaConnected && (
              <Button size="sm" variant="outline" onClick={() => testConnection('meta')}>
                <StatusIcon service="meta" />
                Verificar conexão
              </Button>
            )}
          </div>

          {isMetaConnected ? (
            <div className="flex items-center justify-between p-3 rounded-[12px] bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle size={15} className="text-green-500" />
                <span className="text-sm text-text2">Conta Meta conectada</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={openMetaOAuth}
                  className="text-xs text-text3 hover:text-text2 underline transition-colors"
                >
                  Reconectar
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Desconectar conta Meta? O token será removido.')) return
                    try {
                      const updated = await settingsApi.update({ meta_token: '' } as Partial<Settings>)
                      setSettings(updated)
                      success('Conta Meta desconectada.')
                    } catch {
                      error('Erro ao desconectar')
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-300 underline transition-colors"
                >
                  Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-text3">
                Conecte sua conta Facebook/Meta para ter acesso a todas as contas de anúncios e perfis Instagram da plataforma.
              </p>
              <button
                onClick={openMetaOAuth}
                className="flex items-center justify-center gap-2.5 h-10 w-full rounded-[12px] text-white text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#1877F2' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Conectar com Facebook
              </button>
              <button
                onClick={copyMetaOAuthLink}
                className="flex items-center justify-center gap-2 h-9 w-full rounded-[12px] text-text3 text-xs font-medium border border-[var(--border)] hover:text-text2 hover:border-accent transition-colors"
              >
                <Copy size={13} />
                Copiar link (para colar em outro navegador)
              </button>
            </div>
          )}
        </div>

        {/* Other integrations */}
        {otherIntegrations.map((integration) => (
          <div key={integration.id} className="bg-surface border border-[var(--border)] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{integration.icon}</span>
                <h3 className="font-syne font-semibold text-text">{integration.title}</h3>
                <StatusIcon service={integration.id} />
              </div>
              <Button size="sm" variant="outline" onClick={() => testConnection(integration.id)}>
                Verificar e conectar
              </Button>
            </div>

            <div className="space-y-3">
              {integration.fields.map((field) => {
                const isSecret = field.type === 'password'
                const currentVal = settings[field.key as keyof Settings] as string
                const isShown = show[field.key]

                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text2 font-syne">{field.label}</label>
                    <div className="relative">
                      <input
                        type={isSecret && !isShown ? 'password' : 'text'}
                        value={currentVal || ''}
                        onChange={(e) => set(field.key as keyof Settings, e.target.value)}
                        placeholder={isSecret ? '••••••••' : `Digite ${field.label.toLowerCase()}`}
                        className="w-full h-10 rounded-[12px] bg-bg3 border border-[var(--border)] text-text px-3 pr-10 text-sm focus:outline-none focus:border-accent transition-colors"
                      />
                      {isSecret && (
                        <button
                          type="button"
                          onClick={() => setShow((s) => ({ ...s, [field.key]: !s[field.key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text2 transition-colors"
                        >
                          {isShown ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Available Models */}
        <div className="bg-surface border border-[var(--border)] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-syne font-semibold text-text">Modelos disponíveis</h3>
            <Button size="sm" variant="outline" onClick={() => setShowAddModel(true)}>
              <Plus size={13} />
              Adicionar modelo
            </Button>
          </div>

          <div className="space-y-2">
            {models.length === 0 ? (
              <p className="text-sm text-text3">Nenhum modelo configurado</p>
            ) : models.map((model) => (
              <div key={model.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-3">
                  <Badge variant={model.provider === 'openai' ? 'info' : 'purple'}>
                    {model.provider}
                  </Badge>
                  <span className="text-sm text-text">{model.display_name}</span>
                  <span className="text-xs text-text3 font-mono">{model.slug}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle
                    checked={model.is_active}
                    onChange={(v) => toggleModel(model.id, v)}
                  />
                  <button
                    onClick={() => deleteModel(model.id)}
                    className="text-text3 hover:text-red transition-colors p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notion + Drive OAuth placeholders */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-[var(--border)] rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📓</span>
              <h3 className="font-syne font-semibold text-text">Notion</h3>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => {}}>
              Conectar com Notion
            </Button>
          </div>
          <div className="bg-surface border border-[var(--border)] rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📁</span>
              <h3 className="font-syne font-semibold text-text">Google Drive</h3>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => {}}>
              Conectar Google Drive
            </Button>
          </div>
        </div>
      </div>

      <Modal open={showAddModel} onClose={() => setShowAddModel(false)} title="Adicionar modelo">
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text2 font-syne">Provedor</label>
            <select
              value={newModel.provider}
              onChange={(e) => setNewModel((p) => ({ ...p, provider: e.target.value as 'openai' | 'anthropic' }))}
              className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <Input
            label="Slug do modelo"
            placeholder="gpt-5-turbo"
            value={newModel.slug}
            onChange={(e) => setNewModel((p) => ({ ...p, slug: e.target.value }))}
          />
          <Input
            label="Nome de exibição"
            placeholder="GPT-5 Turbo"
            value={newModel.display_name}
            onChange={(e) => setNewModel((p) => ({ ...p, display_name: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowAddModel(false)} className="flex-1">Cancelar</Button>
            <Button onClick={addModel} className="flex-1">Adicionar</Button>
          </div>
        </div>
      </Modal>
    </Shell>
  )
}

export default function SettingsPage() {
  return <SettingsPageInner />
}
