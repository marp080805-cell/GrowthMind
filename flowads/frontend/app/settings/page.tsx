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
import { maskToken } from '@/lib/utils'
import {
  CheckCircle, XCircle, Eye, EyeOff, Plus, Trash2,
  Save, RefreshCw
} from 'lucide-react'

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error'

export default function SettingsPage() {
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
  }, [])

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
      const { ok, message } = await settingsApi.test(service)
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

  const integrations = [
    {
      id: 'meta',
      title: 'Meta API',
      icon: '📘',
      fields: [{ key: 'meta_token', label: 'Token de acesso longo', type: 'password' }],
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp API',
      icon: '💬',
      fields: [
        { key: 'whatsapp_url', label: 'URL base da API', type: 'text' },
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
        {integrations.map((integration) => (
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
                        value={isSecret && !isShown && currentVal ? maskToken(currentVal) : (currentVal || '')}
                        onChange={(e) => {
                          if (isSecret && !isShown) return
                          set(field.key as keyof Settings, e.target.value)
                        }}
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
