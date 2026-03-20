'use client'

import { useState, useEffect } from 'react'
import { Shell } from '@/components/layout/shell'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatDateTime, formatDuration, getInitials, getAvatarColor } from '@/lib/utils'
import { Users, Brain, Activity, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  active_clients: number
  running_automations: number
  executions_today: number
  errors_24h: number
}

interface RecentExecution {
  id: string
  automation_name: string
  client_name: string
  status: 'success' | 'error' | 'running'
  started_at: string
  duration_ms: number
}

interface ClientPreview {
  id: string
  name: string
  business_type: string
  status: string
  automations_count: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [executions, setExecutions] = useState<RecentExecution[]>([])
  const [clients, setClients] = useState<ClientPreview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/dashboard/stats'),
      api.get<RecentExecution[]>('/dashboard/executions'),
      api.get<ClientPreview[]>('/clients'),
    ])
      .then(([s, e, c]) => {
        setStats(s)
        setExecutions(e)
        setClients(c.slice(0, 6))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const statCards = [
    {
      label: 'Clientes ativos',
      value: stats?.active_clients,
      icon: Users,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      label: 'Automações rodando',
      value: stats?.running_automations,
      icon: Brain,
      color: 'text-green',
      bg: 'bg-green/10',
    },
    {
      label: 'Execuções hoje',
      value: stats?.executions_today,
      icon: Activity,
      color: 'text-cyan',
      bg: 'bg-cyan/10',
    },
    {
      label: 'Erros 24h',
      value: stats?.errors_24h,
      icon: AlertCircle,
      color: 'text-red',
      bg: 'bg-red/10',
    },
  ]

  return (
    <Shell title="Dashboard">
      <div className="space-y-7">
        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="bg-surface border border-[var(--border)] rounded-lg p-5"
            >
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : (
                <>
                  <div className={`w-9 h-9 rounded-[10px] ${card.bg} flex items-center justify-center mb-3`}>
                    <card.icon size={18} className={card.color} />
                  </div>
                  <p className="font-syne font-bold text-3xl text-text">
                    {card.value ?? 0}
                  </p>
                  <p className="text-sm text-text2 mt-1">{card.label}</p>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Clients Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-semibold text-text">Clientes</h2>
            <Link href="/clients" className="text-sm text-accent hover:text-accent/80 transition-colors">
              Ver todos →
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-surface border border-[var(--border)] rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {clients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="bg-surface border border-[var(--border)] rounded-lg p-4 hover:border-[var(--border2)] hover:bg-surface2/50 transition-all cursor-pointer block"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-syne font-bold text-white shrink-0"
                      style={{ backgroundColor: getAvatarColor(client.name) }}
                    >
                      {getInitials(client.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text truncate">{client.name}</p>
                      <p className="text-xs text-text2">{client.business_type}</p>
                    </div>
                    <Badge variant={client.status === 'active' ? 'success' : 'warning'}>
                      {client.status === 'active' ? 'Ativo' : 'Pausado'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-text3">
                    <Brain size={12} />
                    <span>{client.automations_count || 0} automações</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Executions */}
        <div>
          <h2 className="font-syne font-semibold text-text mb-4">Últimas execuções</h2>
          <div className="bg-surface border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left text-xs font-syne font-semibold text-text3 px-4 py-3">Automação</th>
                  <th className="text-left text-xs font-syne font-semibold text-text3 px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-syne font-semibold text-text3 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-syne font-semibold text-text3 px-4 py-3">Início</th>
                  <th className="text-left text-xs font-syne font-semibold text-text3 px-4 py-3">Duração</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : executions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text3 text-sm">
                      Nenhuma execução registrada
                    </td>
                  </tr>
                ) : (
                  executions.map((exec) => (
                    <tr key={exec.id} className="border-b border-[var(--border)] last:border-0 hover:bg-bg3/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-text font-medium">{exec.automation_name}</td>
                      <td className="px-4 py-3 text-sm text-text2">{exec.client_name}</td>
                      <td className="px-4 py-3">
                        {exec.status === 'success' && (
                          <span className="flex items-center gap-1.5 text-green text-sm">
                            <CheckCircle size={14} /> Sucesso
                          </span>
                        )}
                        {exec.status === 'error' && (
                          <span className="flex items-center gap-1.5 text-red text-sm">
                            <XCircle size={14} /> Erro
                          </span>
                        )}
                        {exec.status === 'running' && (
                          <span className="flex items-center gap-1.5 text-yellow text-sm">
                            <Loader2 size={14} className="animate-spin" /> Rodando
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text2">
                        {formatDateTime(exec.started_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text2">
                        {exec.duration_ms ? formatDuration(exec.duration_ms) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  )
}
