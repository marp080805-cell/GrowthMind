'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  was_audio?: boolean
  created_at: string
}

type ListeningState = 'idle' | 'listening' | 'processing'


// ─── Voz do Jarvis (Web Speech API) ──────────────────────────────────────────

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const clean = text.replace(/[*_~`#]/g, '').replace(/https?:\/\/\S+/g, '').slice(0, 400)
  const utter = new SpeechSynthesisUtterance(clean)
  utter.lang = 'pt-BR'
  utter.rate = 1.05
  utter.pitch = 0.85  // voz ligeiramente mais grave, estilo Jarvis
  utter.volume = 0.9

  // Tenta usar voz masculina PT-BR
  const voices = window.speechSynthesis.getVoices()
  const ptVoice = voices.find(v => v.lang.startsWith('pt') && v.name.toLowerCase().includes('male'))
    || voices.find(v => v.lang.startsWith('pt'))
  if (ptVoice) utter.voice = ptVoice

  window.speechSynthesis.speak(utter)
}

// ─── Hook de gravação de voz ──────────────────────────────────────────────────

function useVoiceRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunksRef.current = []
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mediaRecorderRef.current = mr
    mr.start()
  }, [])

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current
      if (!mr) { resolve(new Blob()); return }
      mr.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: 'audio/webm' }))
        mr.stream.getTracks().forEach(t => t.stop())
      }
      mr.stop()
    })
  }, [])

  return { start, stop }
}

// ─── Componente principal ────────────────────────────────────────────────────

interface JarvisPanelProps {
  onClose: () => void
  fullPage?: boolean
}

export function JarvisPanel({ onClose, fullPage = false }: JarvisPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [listeningState, setListeningState] = useState<ListeningState>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recorder = useVoiceRecorder()

  // Carrega histórico ao abrir
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`${API_URL}/jarvis/history?limit=30`)
        if (res.ok) {
          const data = await res.json() as Message[]
          setMessages(data)
        }
      } catch { /* ignora */ }
      setInitialized(true)
    }
    loadHistory()
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Foco no input
  useEffect(() => {
    if (initialized) setTimeout(() => inputRef.current?.focus(), 100)
  }, [initialized])

  const addMessage = (role: 'user' | 'assistant', content: string, was_audio = false) => {
    const msg: Message = {
      id: Math.random().toString(36),
      role,
      content,
      was_audio,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, msg])
    return msg
  }

  const sendText = useCallback(async (text: string, wasAudio = false) => {
    if (!text.trim() || isLoading) return
    setInput('')
    addMessage('user', text, wasAudio)
    setIsLoading(true)

    try {
      const res = await fetch(`${API_URL}/jarvis/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, channel: 'platform' }),
      })
      const data = await res.json() as { message?: string; error?: string }
      const reply = data.message || data.error || 'Erro desconhecido'
      addMessage('assistant', reply)
      if (voiceEnabled) speak(reply)
    } catch {
      addMessage('assistant', '❌ Erro de conexão com o Jarvis.')
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, voiceEnabled])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendText(input)
    }
  }

  const toggleVoiceInput = useCallback(async () => {
    if (listeningState === 'idle') {
      try {
        await recorder.start()
        setListeningState('listening')
      } catch {
        alert('Microfone não disponível. Verifique as permissões do navegador.')
      }
    } else if (listeningState === 'listening') {
      setListeningState('processing')
      const blob = await recorder.stop()

      // Envia para o backend transcrever
      const formData = new FormData()
      formData.append('file', blob, 'audio.webm')

      try {
        const res = await fetch(`${API_URL}/jarvis/audio`, {
          method: 'POST',
          body: formData,
        })
        const data = await res.json() as { transcription?: string; message?: string; error?: string }
        if (data.transcription) {
          addMessage('user', data.transcription, true)
          if (data.message) {
            addMessage('assistant', data.message)
            if (voiceEnabled) speak(data.message)
          }
        } else {
          addMessage('assistant', data.error || '❌ Não consegui transcrever o áudio.')
        }
      } catch {
        addMessage('assistant', '❌ Erro ao processar áudio.')
      } finally {
        setListeningState('idle')
      }
    }
  }, [listeningState, recorder, voiceEnabled])

  const containerClass = fullPage
    ? 'flex flex-col h-full'
    : 'fixed bottom-6 right-6 w-[420px] h-[600px] flex flex-col z-50 rounded-2xl shadow-2xl overflow-hidden'

  return (
    <div className={containerClass} style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.08)' }}>
        <div className="relative">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            ◈
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0a0f]" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white tracking-wide">JARVIS</div>
          <div className="text-xs" style={{ color: 'rgba(99,102,241,0.8)' }}>
            {isLoading ? 'Processando...' : listeningState === 'listening' ? 'Ouvindo...' : 'Online'}
          </div>
        </div>
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className="p-1.5 rounded-lg transition-colors text-xs"
          style={{ color: voiceEnabled ? '#6366f1' : 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}
          title={voiceEnabled ? 'Desativar voz' : 'Ativar voz'}
        >
          {voiceEnabled ? '🔊' : '🔇'}
        </button>
        {!fullPage && (
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)' }}>
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.3) transparent' }}>
        {!initialized && (
          <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <div className="text-2xl mb-2">◈</div>
            <div className="text-xs">Inicializando...</div>
          </div>
        )}

        {initialized && messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-3">◈</div>
            <div className="text-sm font-medium text-white mb-1">Olá! Sou o Jarvis.</div>
            <div className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Seu assistente de tráfego. Fale, escreva ou use o microfone.</div>
            <div className="grid grid-cols-1 gap-2 text-left">
              {[
                '☀️ Como estão meus clientes hoje?',
                '📊 Métricas do cliente X dessa semana',
                '⏸️ Pausa os anúncios fracos do cliente Y',
                '📸 Sobe o post de vaga do cliente Z',
              ].map(s => (
                <button
                  key={s}
                  onClick={() => sendText(s.replace(/^[^\s]+\s/, ''))}
                  className="text-xs px-3 py-2 rounded-xl text-left transition-all"
                  style={{ background: 'rgba(99,102,241,0.1)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                ◈
              </div>
            )}
            <div
              className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed"
              style={msg.role === 'user'
                ? { background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: 'white', borderBottomRightRadius: '6px' }
                : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.9)', borderBottomLeftRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {msg.was_audio && msg.role === 'user' && <span className="text-xs opacity-60 block mb-1">🎤 áudio transcrito</span>}
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>◈</div>
            <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: '#6366f1', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: 'rgba(99,102,241,0.15)' }}>
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Fale com o Jarvis..."
            disabled={isLoading || listeningState !== 'idle'}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: 'white',
              caretColor: '#6366f1',
            }}
          />

          {/* Mic button */}
          <button
            onClick={toggleVoiceInput}
            disabled={isLoading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0"
            style={{
              background: listeningState === 'listening'
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : listeningState === 'processing'
                  ? 'rgba(99,102,241,0.3)'
                  : 'rgba(99,102,241,0.2)',
              border: `1px solid ${listeningState === 'listening' ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.3)'}`,
              boxShadow: listeningState === 'listening' ? '0 0 12px rgba(239,68,68,0.4)' : 'none',
            }}
          >
            {listeningState === 'processing' ? (
              <div className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent" style={{ animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <span className="text-sm">{listeningState === 'listening' ? '⏹' : '🎤'}</span>
            )}
          </button>

          {/* Send button */}
          <button
            onClick={() => sendText(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0"
            style={{
              background: input.trim() && !isLoading ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: input.trim() && !isLoading ? 'white' : 'rgba(255,255,255,0.2)',
            }}
          >
            ↑
          </button>
        </div>
        {listeningState === 'listening' && (
          <div className="text-center mt-2 text-xs" style={{ color: '#ef4444', animation: 'pulse 1s ease-in-out infinite' }}>
            ● Gravando... clique ⏹ para parar
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>
    </div>
  )
}
