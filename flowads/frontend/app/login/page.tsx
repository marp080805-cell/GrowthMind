'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Lock, Eye, EyeOff, Zap } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        setError('Email ou senha inválidos. Verifique suas credenciais.')
        setLoading(false)
        return
      }

      window.location.href = '/dashboard'
    } catch {
      setError('Erro ao conectar. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(79,111,255,0.15) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Login card */}
      <div className="relative w-full max-w-md px-4">
        <div className="bg-surface border border-[var(--border)] rounded-lg p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-[14px] bg-gradient-to-br from-accent to-accent2 flex items-center justify-center shadow-[0_0_32px_var(--accent-glow)] mb-4">
              <Zap size={28} className="text-white" />
            </div>
            <h1 className="font-syne font-bold text-3xl text-text">
              Flow<span className="text-accent">Ads</span>
            </h1>
            <p className="text-text2 text-sm mt-1">Gestor de tráfego inteligente</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={16} />}
              required
              autoComplete="email"
            />

            <Input
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={16} />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-text3 hover:text-text2 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="bg-red/10 border border-red/20 rounded-[10px] p-3 text-sm text-red">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 mt-2"
              loading={loading}
            >
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
