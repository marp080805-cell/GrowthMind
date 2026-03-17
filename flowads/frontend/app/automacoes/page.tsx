'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Shell } from '@/components/layout/shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Toggle } from '@/components/ui/toggle'
import { Skeleton } from '@/components/ui/skeleton'
import {
  automationsApi, clientsApi, presetsApi,
  type Client, type Automation, type Preset,
} from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  Plus, Copy, Pencil, Trash2, ChevronRight,
  Layers, Search, Zap,
} from 'lucide-react'
import Link from 'next/link'

type AutomationWithClient = Automation & { client_name: string }

const TAG_COLORS: Record<string, 'info' | 'success' | 'purple' | 'orange' | 'cyan' | 'warning'> = {
  meta: 'info', whatsapp: 'success', ia: 'purple',
  notion: 'warning', drive: 'cyan', agendamento: 'orange',
}

export default function AutomacoesPage() {
  const router = useRouter()
  const { success, error } = useToast()

  const [automations, setAutomations] = useState<AutomationWithClient[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'mine' | 'templates'>('mine')
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('')

  // Duplicate modal
  const [duplicating, setDuplicating] = useState<AutomationWithClient | Preset | null>(null)
  const [isDuplicatingPreset, setIsDuplicatingPreset] = useState(false)
  const [targetClientId, setTargetClientId] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deleting, setDeleting] = useState<string | null>(null)

  // New automation modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newClientId, setNewClientId] = useState('')

  useEffect(() => {
    Promise.all([automationsApi.listAll(), clientsApi.list(), presetsApi.list()])
      .then(([autos, cls, prs]) => {
        setAutomations(autos)
        setClients(cls)
        setPresets(prs)
      })
      .catch(() => error('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [])

  const toggleAutomation = async (auto: AutomationWithClient) => {
    try {
      const updated = await automationsApi.toggle(auto.id)
      setAutomations((prev) => prev.map((a) => a.id === auto.id ? { ...a, is_active: updated.is_active } : a))
    } catch {
      error('Erro ao alternar automação')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await automationsApi.delete(id)
      setAutomations((prev) => prev.filter((a) => a.id !== id))
      setDeleting(null)
      success('Automação removida')
    } catch {
      error('Erro ao remover automação')
    }
  }

  const handleDuplicate = async () => {
    if (!duplicating || !targetClientId) return
    setSaving(true)
    try {
      if (isDuplicatingPreset) {
        const preset = duplicating as Preset
        const auto = await presetsApi.apply(preset.id, targetClientId)
        success('Template aplicado! Abrindo builder...')
        router.push(`/clients/${targetClientId}/automations/${auto.id}`)
      } else {
        const src = duplicating as AutomationWithClient
        const auto = await automationsApi.duplicate(src.id, targetClientId)
        success('Automação duplicada!')
        setDuplicating(null)
        router.push(`/clients/${targetClientId}/automations/${auto.id}`)
      }
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro ao duplicar')
    } finally {
      setSaving(false)
    }
  }

  const handleNewAutomation = () => {
    if (!newClientId) return
    router.push(`/clients/${newClientId}/automations/new`)
  }

  const filtered = useMemo(() => {
    return automations.filter((a) => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.client_name.toLowerCase().includes(search.toLowerCase())
      const matchClient = !filterClient || a.client_id === filterClient
      return matchSearch && matchClient
    })
  }, [automations, search, filterClient])

  const filteredPresets = useMemo(() => {
    return presets.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
  }, [presets, search])

  return (
    <Shell
      title="Automações"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar automação..."
              className="h-9 pl-8 pr-3 rounded-[10px] bg-surface border border-[var(--border)] text-sm text-text focus:outline-none focus:border-accent w-52"
            />
          </div>
          <Button size="sm" onClick={() => setShowNewModal(true)}>
            <Plus size={14} />
            Nova Automação
          </Button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="border-b border-[var(--border)] flex gap-1 mb-6">
        {[
          { key: 'mine', label: `Minhas Automações`, count: automations.length },
          { key: 'templates', label: 'Templates', count: presets.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'mine' | 'templates')}
            className={`px-4 py-2.5 text-sm font-syne font-semibold transition-all border-b-2 -mb-px flex items-center gap-2 ${
              tab === t.key ? 'text-accent border-accent' : 'text-text2 border-transparent hover:text-text'
            }`}
          >
            {t.label}
            <span className="text-[10px] bg-surface2 text-text3 px-1.5 py-0.5 rounded-md font-bold">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'mine' && (
        <>
          {/* Client filter */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="h-9 px-3 rounded-[10px] bg-surface border border-[var(--border)] text-sm text-text focus:outline-none focus:border-accent"
            >
              <option value="">Todos os clientes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="text-xs text-text3">{filtered.length} automação{filtered.length !== 1 ? 'ões' : ''}</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-text3">
              <Zap size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma automação encontrada</p>
              <Button size="sm" className="mt-4" onClick={() => setShowNewModal(true)}>
                <Plus size={14} /> Nova Automação
              </Button>
            </div>
          ) : (
            <div className="bg-surface border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
              {filtered.map((auto) => (
                <div key={auto.id} className="flex items-center gap-4 px-4 py-3 hover:bg-bg3/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{auto.name}</p>
                    <p className="text-xs text-text3 mt-0.5">{auto.client_name}</p>
                  </div>
                  <Badge variant={auto.is_active ? 'success' : 'default'}>
                    {auto.is_active ? 'Ativa' : 'Pausada'}
                  </Badge>
                  {auto.last_run_at && (
                    <span className="text-xs text-text3 hidden lg:block">{formatDateTime(auto.last_run_at)}</span>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      title="Duplicar para outro cliente"
                      onClick={() => { setDuplicating(auto); setIsDuplicatingPreset(false); setTargetClientId('') }}
                      className="p-1.5 rounded-[8px] hover:bg-surface2 text-text3 hover:text-text transition-colors"
                    >
                      <Copy size={14} />
                    </button>
                    <Link
                      href={`/clients/${auto.client_id}/automations/${auto.id}`}
                      className="p-1.5 rounded-[8px] hover:bg-surface2 text-text3 hover:text-text transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </Link>
                    <button
                      title="Excluir"
                      onClick={() => setDeleting(auto.id)}
                      className="p-1.5 rounded-[8px] hover:bg-red/10 text-text3 hover:text-red transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    <Toggle checked={auto.is_active} onChange={() => toggleAutomation(auto)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'templates' && (
        <div className="grid grid-cols-3 gap-4">
          {filteredPresets.map((preset) => (
            <div
              key={preset.id}
              className="bg-surface border border-[var(--border)] rounded-lg p-5 hover:border-[var(--border2)] transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">{preset.icon}</span>
                <div>
                  <h3 className="font-syne font-semibold text-text">{preset.name}</h3>
                  <p className="text-xs text-text2 mt-0.5">{preset.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {preset.tags.map((tag) => (
                  <Badge key={tag} variant={TAG_COLORS[tag.toLowerCase()] || 'default'}>{tag}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-text3">{preset.nodes?.length || 0} blocos</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setDuplicating(preset); setIsDuplicatingPreset(true); setTargetClientId('') }}
                >
                  <Layers size={13} />
                  Usar template
                  <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Duplicate / Apply modal */}
      <Modal
        open={!!duplicating}
        onClose={() => setDuplicating(null)}
        title={isDuplicatingPreset ? `Usar template: ${(duplicating as Preset)?.name}` : `Duplicar: ${(duplicating as AutomationWithClient)?.name}`}
        description="Selecione o cliente de destino"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text2 font-syne">Cliente</label>
            <select
              value={targetClientId}
              onChange={(e) => setTargetClientId(e.target.value)}
              className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {!isDuplicatingPreset && (
            <p className="text-xs text-text3">
              Será criada uma cópia da automação (pausada) para o cliente selecionado. Você será redirecionado para o builder para ajustar as configurações.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDuplicating(null)} className="flex-1">Cancelar</Button>
            <Button onClick={handleDuplicate} loading={saving} disabled={!targetClientId} className="flex-1">
              {isDuplicatingPreset ? 'Aplicar template' : 'Duplicar automação'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* New automation modal */}
      <Modal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Nova Automação"
        description="Selecione o cliente para criar a automação"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text2 font-syne">Cliente</label>
            <select
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
              className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowNewModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleNewAutomation} disabled={!newClientId} className="flex-1">
              Criar automação
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover automação"
        description="Essa ação não pode ser desfeita. A automação e todos os seus logs serão removidos."
      >
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
          <Button variant="destructive" onClick={() => deleting && handleDelete(deleting)} className="flex-1">
            Remover
          </Button>
        </div>
      </Modal>
    </Shell>
  )
}
