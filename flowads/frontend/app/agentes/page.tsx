'use client'

import { useState, useEffect, useMemo } from 'react'
import { Shell } from '@/components/layout/shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentForm } from '@/components/agents/agent-form'
import { agentsApi, clientsApi, type Agent, type Client } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Bot, Plus, Pencil, Trash2, Brain, Search } from 'lucide-react'

type AgentWithClient = Agent & { client_name: string }

const providerBadge = (model: string): 'info' | 'purple' | 'default' => {
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'info'
  if (model.startsWith('claude')) return 'purple'
  return 'default'
}

export default function AgentesPage() {
  const { success, error } = useToast()

  const [agents, setAgents] = useState<AgentWithClient[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | undefined>()
  const [formClientId, setFormClientId] = useState('')
  const [showClientSelect, setShowClientSelect] = useState(false)
  const [deleting, setDeleting] = useState<AgentWithClient | null>(null)

  useEffect(() => {
    Promise.all([agentsApi.listAll(), clientsApi.list()])
      .then(([ags, cls]) => { setAgents(ags); setClients(cls) })
      .catch(() => error('Erro ao carregar agentes'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.client_name.toLowerCase().includes(search.toLowerCase())
      const matchClient = !filterClient || a.client_id === filterClient
      return matchSearch && matchClient
    })
  }, [agents, search, filterClient])

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await agentsApi.delete(deleting.client_id, deleting.id)
      setAgents((prev) => prev.filter((a) => a.id !== deleting.id))
      setDeleting(null)
      success('Agente removido')
    } catch {
      error('Erro ao remover agente')
    }
  }

  const openNew = () => {
    setEditingAgent(undefined)
    setFormClientId('')
    setShowClientSelect(true)
  }

  const openEdit = (agent: AgentWithClient) => {
    setEditingAgent(agent)
    setFormClientId(agent.client_id)
    setShowForm(true)
  }

  const handleAgentSaved = (ag: Agent) => {
    const clientName = clients.find((c) => c.id === ag.client_id)?.name || ''
    setAgents((prev) => {
      const exists = prev.find((a) => a.id === ag.id)
      if (exists) return prev.map((a) => a.id === ag.id ? { ...ag, client_name: clientName } : a)
      return [{ ...ag, client_name: clientName }, ...prev]
    })
    setShowForm(false)
    setShowClientSelect(false)
  }

  return (
    <Shell
      title="Agentes"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar agente..."
              className="h-9 pl-8 pr-3 rounded-[10px] bg-surface border border-[var(--border)] text-sm text-text focus:outline-none focus:border-accent w-52"
            />
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus size={14} />
            Novo Agente
          </Button>
        </div>
      }
    >
      {/* Client filter */}
      <div className="flex items-center gap-3 mb-6">
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="h-9 px-3 rounded-[10px] bg-surface border border-[var(--border)] text-sm text-text focus:outline-none focus:border-accent"
        >
          <option value="">Todos os clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-xs text-text3">{filtered.length} agente{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-text3">
          <Bot size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum agente encontrado</p>
          <Button size="sm" className="mt-4" onClick={openNew}>
            <Plus size={14} /> Novo Agente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((agent) => (
            <div key={agent.id} className="bg-surface border border-[var(--border)] rounded-lg p-4 space-y-3 hover:border-[var(--border2)] transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-[10px] bg-accent2/10 flex items-center justify-center shrink-0">
                    <Bot size={18} className="text-accent2" />
                  </div>
                  <div>
                    <p className="font-syne font-semibold text-text text-sm">{agent.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant={providerBadge(agent.model)}>{agent.model}</Badge>
                      <span className="text-[10px] text-text3">{agent.client_name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(agent)}
                    className="p-1.5 rounded-[8px] hover:bg-surface2 text-text3 hover:text-text transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleting(agent)}
                    className="p-1.5 rounded-[8px] hover:bg-red/10 text-text3 hover:text-red transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {agent.system_prompt && (
                <p className="text-xs text-text2 line-clamp-2 bg-bg3 rounded-[8px] px-3 py-2">
                  {agent.system_prompt}
                </p>
              )}

              <div className="flex items-center gap-3 text-xs text-text3">
                <div className="flex items-center gap-1">
                  <Brain size={11} />
                  <span>{agent.memory_enabled ? 'Memória ativa' : 'Sem memória'}</span>
                </div>
                <span>•</span>
                <span>Temp: {agent.temperature}</span>
                <span>•</span>
                <span>{agent.output_format === 'json' ? 'JSON' : 'Texto'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Select client for new agent */}
      <Modal
        open={showClientSelect && !showForm}
        onClose={() => setShowClientSelect(false)}
        title="Novo Agente"
        description="Selecione o cliente para o agente"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text2 font-syne">Cliente</label>
            <select
              value={formClientId}
              onChange={(e) => setFormClientId(e.target.value)}
              className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowClientSelect(false)} className="flex-1">Cancelar</Button>
            <Button disabled={!formClientId} onClick={() => { setShowClientSelect(false); setShowForm(true) }} className="flex-1">
              Continuar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Agent form */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingAgent ? 'Editar Agente' : 'Novo Agente'}
        size="lg"
      >
        {showForm && (
          <AgentForm
            clientId={formClientId}
            agent={editingAgent}
            onSuccess={handleAgentSaved}
            onCancel={() => setShowForm(false)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover agente"
        description={`Remover "${deleting?.name}"? Essa ação não pode ser desfeita.`}
      >
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete} className="flex-1">Remover</Button>
        </div>
      </Modal>
    </Shell>
  )
}
