'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Shell } from '@/components/layout/shell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Drawer } from '@/components/ui/drawer'
import { Toggle } from '@/components/ui/toggle'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientForm } from '@/components/clients/client-form'
import { CampaignRow } from '@/components/clients/campaign-row'
import { AgentCard } from '@/components/agents/agent-card'
import { AgentForm } from '@/components/agents/agent-form'
import {
  clientsApi, campaignsApi, automationsApi, agentsApi,
  type Client, type Campaign, type Automation, type Agent, type ExecutionLog
} from '@/lib/api'
import {
  getInitials, getAvatarColor, formatDateTime, formatDuration
} from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  Pencil, RefreshCw, Plus, Layers, Play, Pause,
  CheckCircle, XCircle, Loader2, ChevronRight
} from 'lucide-react'
import Link from 'next/link'

type Tab = 'overview' | 'campaigns' | 'automations' | 'agents' | 'logs'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { success, error } = useToast()

  const [client, setClient] = useState<Client | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [automations, setAutomations] = useState<Automation[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null)

  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [syncingCampaigns, setSyncingCampaigns] = useState(false)

  const [showEditClient, setShowEditClient] = useState(false)
  const [showAgentForm, setShowAgentForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | undefined>()

  useEffect(() => {
    Promise.all([
      clientsApi.get(id),
      campaignsApi.list(id),
      automationsApi.list(id),
      agentsApi.list(id),
    ])
      .then(([c, camps, autos, ags]) => {
        setClient(c)
        setCampaigns(camps)
        setAutomations(autos)
        setAgents(ags)
      })
      .catch(() => error('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (tab === 'logs') {
      Promise.all(
        automations.map((a) => automationsApi.logs(a.id))
      ).then((all) => setLogs(all.flat().sort((a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      )))
    }
  }, [tab, automations])

  const syncCampaigns = async () => {
    setSyncingCampaigns(true)
    try {
      const updated = await campaignsApi.list(id)
      setCampaigns(updated)
      success('Campanhas sincronizadas!')
    } catch {
      error('Erro ao sincronizar campanhas')
    } finally {
      setSyncingCampaigns(false)
    }
  }

  const toggleAutomation = async (automation: Automation) => {
    try {
      const updated = await automationsApi.toggle(automation.id)
      setAutomations((prev) =>
        prev.map((a) => a.id === automation.id ? { ...a, is_active: updated.is_active } : a)
      )
    } catch {
      error('Erro ao alternar automação')
    }
  }

  const deleteAgent = async (agentId: string) => {
    try {
      await agentsApi.delete(id, agentId)
      setAgents((prev) => prev.filter((a) => a.id !== agentId))
      success('Agente removido')
    } catch {
      error('Erro ao remover agente')
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Visão Geral' },
    { key: 'campaigns', label: 'Campanhas' },
    { key: 'automations', label: 'Automações' },
    { key: 'agents', label: 'Agentes' },
    { key: 'logs', label: 'Logs' },
  ]

  if (loading) {
    return (
      <Shell
        title="Carregando..."
        breadcrumbs={[{ label: 'Clientes', href: '/clients' }, { label: '...' }]}
      >
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Shell>
    )
  }

  if (!client) return null

  return (
    <Shell
      title={client.name}
      breadcrumbs={[
        { label: 'Clientes', href: '/clients' },
        { label: client.name },
      ]}
      actions={
        <Button variant="outline" size="sm" onClick={() => setShowEditClient(true)}>
          <Pencil size={14} />
          Editar
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Client Header */}
        <div className="bg-surface border border-[var(--border)] rounded-lg p-5 flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-syne font-bold text-white shrink-0"
            style={{ backgroundColor: getAvatarColor(client.name) }}
          >
            {getInitials(client.name)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-syne font-bold text-2xl text-text">{client.name}</h1>
              <Badge variant={client.status === 'active' ? 'success' : 'warning'}>
                {client.status === 'active' ? 'Ativo' : 'Pausado'}
              </Badge>
            </div>
            <p className="text-text2">{client.business_type}</p>
            {client.whatsapp && (
              <p className="text-sm text-text3 mt-1">{client.whatsapp}</p>
            )}
          </div>
          <div className="text-right text-sm text-text3">
            <p>{automations.length} automações</p>
            <p>{campaigns.length} campanhas</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--border)] flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-syne font-semibold transition-all border-b-2 -mb-px ${
                tab === t.key
                  ? 'text-accent border-accent'
                  : 'text-text2 border-transparent hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-surface border border-[var(--border)] rounded-lg p-5 space-y-4">
              <h3 className="font-syne font-semibold text-text">Dados do cliente</h3>
              <div className="space-y-3">
                {[
                  { label: 'Nome', value: client.name },
                  { label: 'Tipo de negócio', value: client.business_type },
                  { label: 'WhatsApp', value: client.whatsapp },
                  { label: 'Conta Meta', value: client.ad_account_id },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-text3 mb-0.5">{label}</p>
                    <p className="text-sm text-text">{value || '—'}</p>
                  </div>
                ))}
                {client.context && (
                  <div>
                    <p className="text-xs text-text3 mb-0.5">Contexto</p>
                    <p className="text-sm text-text2 line-clamp-4">{client.context}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-surface border border-[var(--border)] rounded-lg p-5">
              <h3 className="font-syne font-semibold text-text mb-4">Resumo Meta Ads</h3>
              <p className="text-sm text-text3">
                {client.ad_account_id
                  ? 'Clique em "Campanhas" para ver métricas detalhadas'
                  : 'Nenhuma conta Meta conectada'}
              </p>
            </div>
          </div>
        )}

        {tab === 'campaigns' && (
          <div>
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={syncCampaigns}
                loading={syncingCampaigns}
              >
                <RefreshCw size={14} />
                Sincronizar campanhas
              </Button>
            </div>
            <div className="bg-surface border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[var(--border)] text-xs font-syne font-semibold text-text3">
                <span className="flex-1">Campanha</span>
                <span className="w-24">Status</span>
                <span className="w-28 text-right">Objetivo</span>
                <span className="w-24 text-right">Orçamento</span>
                <span className="w-6" />
              </div>
              {campaigns.length === 0 ? (
                <p className="text-center py-10 text-sm text-text3">
                  Nenhuma campanha. Clique em "Sincronizar campanhas"
                </p>
              ) : (
                campaigns.map((c) => (
                  <CampaignRow key={c.id} campaign={c} clientId={id} />
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'automations' && (
          <div>
            <div className="flex items-center gap-2 justify-end mb-4">
              <Link href={`/presets?clientId=${id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Layers size={14} />
                Usar Preset
              </Link>
              <Link href={`/clients/${id}/automations/new`} className={buttonVariants({ size: 'sm' })}>
                <Plus size={14} />
                Nova Automação
              </Link>
            </div>
            <div className="bg-surface border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
              {automations.length === 0 ? (
                <p className="text-center py-10 text-sm text-text3">
                  Nenhuma automação criada ainda
                </p>
              ) : (
                automations.map((auto) => (
                  <div key={auto.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text">{auto.name}</p>
                      {auto.description && (
                        <p className="text-xs text-text2 truncate">{auto.description}</p>
                      )}
                    </div>
                    <Badge variant={auto.is_active ? 'success' : 'default'}>
                      {auto.is_active ? 'Ativa' : 'Pausada'}
                    </Badge>
                    {auto.last_run_at && (
                      <span className="text-xs text-text3">
                        {formatDateTime(auto.last_run_at)}
                      </span>
                    )}
                    <Link href={`/clients/${id}/automations/${auto.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                      Editar
                      <ChevronRight size={13} />
                    </Link>
                    <Toggle
                      checked={auto.is_active}
                      onChange={() => toggleAutomation(auto)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'agents' && (
          <div>
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => { setEditingAgent(undefined); setShowAgentForm(true) }}>
                <Plus size={14} />
                Novo Agente
              </Button>
            </div>
            {agents.length === 0 ? (
              <p className="text-center py-10 text-sm text-text3">
                Nenhum agente criado ainda
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {agents.map((ag) => (
                  <AgentCard
                    key={ag.id}
                    agent={ag}
                    onEdit={(a) => { setEditingAgent(a); setShowAgentForm(true) }}
                    onDelete={deleteAgent}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'logs' && (
          <div className="bg-surface border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Automação', 'Status', 'Início', 'Duração', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-syne font-semibold text-text3 px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-text3">Nenhum log registrado</td></tr>
                ) : logs.map((log) => {
                  const auto = automations.find((a) => a.id === log.automation_id)
                  return (
                    <tr key={log.id} className="border-b border-[var(--border)] last:border-0 hover:bg-bg3/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-text">{auto?.name || '—'}</td>
                      <td className="px-4 py-3">
                        {log.status === 'success' && <span className="flex items-center gap-1.5 text-green text-sm"><CheckCircle size={14} /> Sucesso</span>}
                        {log.status === 'error' && <span className="flex items-center gap-1.5 text-red text-sm"><XCircle size={14} /> Erro</span>}
                        {log.status === 'running' && <span className="flex items-center gap-1.5 text-yellow text-sm"><Loader2 size={14} className="animate-spin" /> Rodando</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-text2">{formatDateTime(log.started_at)}</td>
                      <td className="px-4 py-3 text-sm text-text2">
                        {log.finished_at ? formatDuration(new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedLog(log)}>
                          Ver detalhes
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Client Modal */}
      <Modal open={showEditClient} onClose={() => setShowEditClient(false)} title="Editar Cliente" size="lg">
        <ClientForm
          client={client}
          onSuccess={(updated) => { setClient(updated); setShowEditClient(false) }}
          onCancel={() => setShowEditClient(false)}
        />
      </Modal>

      {/* Agent Form Modal */}
      <Modal
        open={showAgentForm}
        onClose={() => setShowAgentForm(false)}
        title={editingAgent ? 'Editar Agente' : 'Novo Agente'}
        size="lg"
      >
        <AgentForm
          clientId={id}
          agent={editingAgent}
          onSuccess={(ag) => {
            setAgents((prev) =>
              editingAgent
                ? prev.map((a) => a.id === ag.id ? ag : a)
                : [ag, ...prev]
            )
            setShowAgentForm(false)
          }}
          onCancel={() => setShowAgentForm(false)}
        />
      </Modal>

      {/* Log Drawer */}
      <Drawer
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Detalhes da execução"
        width="520px"
      >
        {selectedLog && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              {selectedLog.status === 'success' && <Badge variant="success">Sucesso</Badge>}
              {selectedLog.status === 'error' && <Badge variant="error">Erro</Badge>}
              {selectedLog.status === 'running' && <Badge variant="warning">Rodando</Badge>}
              <span className="text-xs text-text3">{formatDateTime(selectedLog.started_at)}</span>
            </div>
            {selectedLog.log_data.map((node, i) => (
              <div key={i} className="bg-bg3 rounded-[10px] p-3 border border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {node.status === 'success' && <CheckCircle size={13} className="text-green" />}
                    {node.status === 'error' && <XCircle size={13} className="text-red" />}
                    {node.status === 'running' && <Loader2 size={13} className="text-yellow animate-spin" />}
                    <span className="text-sm font-syne font-semibold text-text">
                      {node.node_label || node.node_type}
                    </span>
                  </div>
                  <span className="text-xs text-text3">{formatDuration(node.duration_ms)}</span>
                </div>
                {!!node.error && (
                  <p className="text-xs text-red bg-red/10 rounded-[6px] p-2 mb-2">{node.error}</p>
                )}
                {!!node.output && (
                  <details className="group">
                    <summary className="text-xs text-text3 cursor-pointer hover:text-text2">Output</summary>
                    <pre className="text-xs text-text2 mt-1 overflow-auto max-h-32 bg-bg2 rounded-[6px] p-2">
                      {JSON.stringify(node.output, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </Shell>
  )
}
