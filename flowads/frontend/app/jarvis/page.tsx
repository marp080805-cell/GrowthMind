'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { JarvisPanel } from '@/components/jarvis/jarvis-panel'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Memory { id: string; key: string; value: string; category: string; client_name?: string; updated_at: string }
interface ActionLog { id: string; client_name?: string; action_type: string; success: boolean; executed_at: string }

export default function JarvisPage() {
  const [tab, setTab] = useState<'chat' | 'memory' | 'log'>('chat')
  const [memories, setMemories] = useState<Memory[]>([])
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [stats, setStats] = useState({ message_count: 0, memory_count: 0 })

  useEffect(() => {
    fetch(`${API_URL}/jarvis/session`).then(r => r.json()).then(setStats).catch(() => {})
    if (tab === 'memory') fetch(`${API_URL}/jarvis/memories`).then(r => r.json()).then(setMemories).catch(() => {})
    if (tab === 'log') fetch(`${API_URL}/jarvis/log`).then(r => r.json()).then(setLogs).catch(() => {})
  }, [tab])

  const deleteMemory = async (id: string) => {
    await fetch(`${API_URL}/jarvis/memories/${id}`, { method: 'DELETE' })
    setMemories(prev => prev.filter(m => m.id !== id))
  }

  const clearHistory = async () => {
    if (!confirm('Limpar todo o histórico de conversa?')) return
    await fetch(`${API_URL}/jarvis/history`, { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #050508 0%, #080812 50%, #050508 100%)' }}>

      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-5 border-b" style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
        <Link href="/dashboard" className="text-sm transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}>
          ← Voltar
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
            ◈
          </div>
          <div>
            <div className="text-lg font-bold text-white tracking-wide">JARVIS</div>
            <div className="text-xs" style={{ color: 'rgba(99,102,241,0.7)' }}>Centro de Comando — AdMind</div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          {[
            { label: 'Mensagens', value: stats.message_count },
            { label: 'Memórias', value: stats.memory_count },
          ].map(s => (
            <div key={s.label} className="text-right">
              <div className="text-lg font-bold text-white">{s.value}</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-8 py-3 border-b" style={{ borderColor: 'rgba(99,102,241,0.1)' }}>
        {(['chat', 'memory', 'log'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize"
            style={{
              background: tab === t ? 'rgba(99,102,241,0.25)' : 'transparent',
              color: tab === t ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
              border: tab === t ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
            }}
          >
            {t === 'chat' ? '💬 Chat' : t === 'memory' ? '🧠 Memórias' : '📋 Log de Ações'}
          </button>
        ))}

        <div className="flex-1" />

        {tab === 'chat' && (
          <button onClick={clearHistory} className="text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'rgba(239,68,68,0.6)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            Limpar histórico
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-4">
        {tab === 'chat' && (
          <div className="h-full" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <JarvisPanel onClose={() => {}} fullPage />
          </div>
        )}

        {tab === 'memory' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Tudo que o Jarvis aprendeu com você. Para ensinar algo novo, basta dizer no chat: <span style={{ color: '#a5b4fc' }}>"Aprende que..."</span>
            </div>

            {memories.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <div className="text-3xl mb-3">🧠</div>
                <div>Nenhuma memória ainda.</div>
                <div className="text-sm mt-1">Ensine algo ao Jarvis no chat!</div>
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map(m => (
                  <div key={m.id} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>{m.category}</span>
                        {m.client_name && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>👤 {m.client_name}</span>}
                        <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.25)' }}>{new Date(m.updated_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="text-xs font-mono mb-0.5" style={{ color: 'rgba(165,180,252,0.6)' }}>{m.key}</div>
                      <div className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{m.value}</div>
                    </div>
                    <button onClick={() => deleteMemory(m.id)} className="text-xs shrink-0 mt-0.5 transition-colors" style={{ color: 'rgba(239,68,68,0.5)' }} title="Remover memória">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'log' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Todas as ações executadas pelo Jarvis na Meta API.
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <div className="text-3xl mb-3">📋</div>
                <div>Nenhuma ação executada ainda.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(l => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-sm">{l.success ? '✅' : '❌'}</span>
                    <div className="flex-1">
                      <span className="text-sm text-white font-medium">{l.action_type.replace(/_/g, ' ')}</span>
                      {l.client_name && <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.4)' }}>— {l.client_name}</span>}
                    </div>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{new Date(l.executed_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
