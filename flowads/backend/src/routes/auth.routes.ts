import type { FastifyPluginAsync } from 'fastify'
import { supabase } from '../lib/supabase'

const META_SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'pages_read_engagement',
  'pages_show_list',
  'instagram_basic',
].join(',')

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Meta OAuth ────────────────────────────────────────────────────────────

  fastify.get('/auth/meta/connect', async (req, reply) => {
    const { client_id, type } = req.query as { client_id?: string; type?: string }
    const appId = process.env.META_APP_ID
    const redirectUri = process.env.META_REDIRECT_URI
    if (!appId || !redirectUri) return reply.status(500).send({ message: 'META_APP_ID ou META_REDIRECT_URI não configurados' })

    const state = Buffer.from(JSON.stringify({
      client_id: client_id || 'new',
      type: type || 'client',
      csrf: Math.random().toString(36).slice(2),
    })).toString('base64url')

    const url = new URL('https://www.facebook.com/v21.0/dialog/oauth')
    url.searchParams.set('client_id', appId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', META_SCOPES)
    url.searchParams.set('state', state)
    url.searchParams.set('response_type', 'code')

    return reply.redirect(url.toString())
  })

  fastify.get('/auth/meta/callback', async (req, reply) => {
    const { code, state, error_reason } = req.query as { code?: string; state?: string; error_reason?: string }
    const frontendUrl = process.env.FRONTEND_URL || 'https://growthmind.zi-ai.site'
    const appId = process.env.META_APP_ID!
    const appSecret = process.env.META_APP_SECRET!
    const redirectUri = process.env.META_REDIRECT_URI!

    if (error_reason || !code) {
      return reply.redirect(`${frontendUrl}/clients?meta_error=cancelled`)
    }

    let clientId = 'new'
    let connectionType = 'client'
    try {
      const stateData = JSON.parse(Buffer.from(state || '', 'base64url').toString())
      clientId = stateData.client_id || 'new'
      connectionType = stateData.type || 'client'
    } catch { /* ignore */ }

    // Troca code por short-lived token
    const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl.toString())
    const tokenData = await tokenRes.json() as { access_token?: string }

    if (!tokenData.access_token) {
      return reply.redirect(`${frontendUrl}/clients?meta_error=token_failed`)
    }

    // Troca por long-lived token (60 dias)
    const longUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
    longUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longUrl.searchParams.set('client_id', appId)
    longUrl.searchParams.set('client_secret', appSecret)
    longUrl.searchParams.set('fb_exchange_token', tokenData.access_token)

    const longRes = await fetch(longUrl.toString())
    const longData = await longRes.json() as { access_token?: string }
    const finalToken = longData.access_token || tokenData.access_token

    // Settings-level connection: save to settings table
    if (connectionType === 'settings') {
      const { data: existing } = await supabase.from('settings').select('id').single()
      if (existing) {
        await supabase.from('settings').update({ meta_token: finalToken }).eq('id', existing.id)
      } else {
        await supabase.from('settings').insert({ meta_token: finalToken })
      }
      return reply.redirect(`${frontendUrl}/settings?meta_connected=1`)
    }

    // Client-level connection (legacy)
    if (clientId !== 'new') {
      await supabase.from('clients').update({ meta_token: finalToken }).eq('id', clientId)
      return reply.redirect(`${frontendUrl}/clients?meta_connected=${clientId}`)
    }

    return reply.redirect(`${frontendUrl}/clients?meta_token=${encodeURIComponent(finalToken)}`)
  })

  // ─── App auth ──────────────────────────────────────────────────────────────

  fastify.post('/auth/login', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return reply.status(401).send({ message: 'Credenciais inválidas' })

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    return { token: data.session?.access_token, user }
  })

  fastify.post('/auth/logout', async (req, reply) => {
    await supabase.auth.signOut()
    return reply.send({ ok: true })
  })

  fastify.get('/auth/me', async (req, reply) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return reply.status(401).send({ message: 'Não autorizado' })

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return reply.status(401).send({ message: 'Token inválido' })

    const { data: dbUser } = await supabase.from('users').select('*').eq('email', user.email).single()
    return dbUser || user
  })
}
