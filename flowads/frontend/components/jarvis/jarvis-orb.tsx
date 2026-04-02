'use client'

import { useState, useEffect } from 'react'
import { JarvisPanel } from './jarvis-panel'

export function JarvisOrb() {
  const [open, setOpen] = useState(false)

  // Atalho de teclado: Ctrl+J para abrir/fechar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      {/* Orb flutuante */}
      <button
        onClick={() => setOpen(prev => !prev)}
        title="Jarvis — Assistente de Tráfego (Ctrl+J)"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 select-none"
        style={{
          background: open
            ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
            : 'linear-gradient(135deg, #6366f1, #4f46e5)',
          boxShadow: open
            ? '0 0 0 3px rgba(99,102,241,0.4), 0 0 32px rgba(99,102,241,0.5)'
            : '0 0 0 2px rgba(99,102,241,0.3), 0 8px 24px rgba(0,0,0,0.4)',
          transform: open ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <span
          className="text-xl font-bold"
          style={{
            color: 'white',
            animation: open ? 'none' : 'orbPulse 3s ease-in-out infinite',
          }}
        >
          {open ? '✕' : '◈'}
        </span>

        {/* Anel pulsante quando fechado */}
        {!open && (
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: 'transparent',
              border: '2px solid rgba(99,102,241,0.4)',
              animation: 'orbRing 3s ease-in-out infinite',
            }}
          />
        )}
      </button>

      {/* Painel lateral */}
      {open && <JarvisPanel onClose={() => setOpen(false)} />}

      <style>{`
        @keyframes orbPulse {
          0%, 100% { opacity: 1; transform: scale(1) }
          50% { opacity: 0.8; transform: scale(0.95) }
        }
        @keyframes orbRing {
          0% { transform: scale(1); opacity: 0.6 }
          50% { transform: scale(1.4); opacity: 0 }
          100% { transform: scale(1); opacity: 0.6 }
        }
      `}</style>
    </>
  )
}
