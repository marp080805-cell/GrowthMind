import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

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

    const secret = new TextEncoder().encode(authSecret)

    // Login do admin principal (credenciais fixas no .env)
    const adminEmail = process.env.ADMIN_EMAIL?.trim()
    const adminPassword = process.env.ADMIN_PASSWORD?.trim()

    if (adminEmail && adminPassword) {
      if (email.trim() === adminEmail && password === adminPassword) {
        const token = await new SignJWT({ role: 'admin', email })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(secret)

        const response = NextResponse.json({ success: true })
        setAuthCookie(response, token)
        return response
      }
      return NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 })
    }

    // Fallback: Supabase (apenas se admin não configurado)
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      })

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (!error && data.user) {
        const token = await new SignJWT({ role: 'user', sub: data.user.id })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(secret)

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
