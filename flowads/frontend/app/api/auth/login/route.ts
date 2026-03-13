import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'

function createToken(secret: string, subject: string): string {
  const payload = `${subject}:${Date.now()}`
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    path: '/',
  })
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const authSecret = process.env.AUTH_SECRET
    if (!authSecret) {
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    // 1. Login do admin principal (credenciais fixas no .env)
    const adminEmail = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD

    if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
      const token = createToken(authSecret, `admin:${email}`)
      const response = NextResponse.json({ success: true })
      setAuthCookie(response, token)
      return response
    }

    // 2. Login de usuários comuns via Supabase Auth (processado no servidor)
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      })

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (!error && data.user) {
        const token = createToken(authSecret, `user:${data.user.id}`)
        const response = NextResponse.json({ success: true })
        setAuthCookie(response, token)
        return response
      }
    }

    return NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })
  }
}
