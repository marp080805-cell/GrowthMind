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
    const { client_id, type, format } = req.query as { client_id?: string; type?: string; format?: string }
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

    console.log('[Meta OAuth] Generating OAuth URL', { type, redirect_uri: redirectUri, format })

    // Return URL as JSON for copy-link feature
    if (format === 'url') {
      return { url: url.toString(), redirect_uri: redirectUri }
    }

    return reply.redirect(url.toString())
  })

  fastify.get('/auth/meta/callback', async (req, reply) => {
    const { code, state, error_reason, error_description } = req.query as {
      code?: string; state?: string; error_reason?: string; error_description?: string
    }
    const frontendUrl = process.env.FRONTEND_URL || 'https://growthmind.zi-ai.site'
    const appId = process.env.META_APP_ID!
    const appSecret = process.env.META_APP_SECRET!
    const redirectUri = process.env.META_REDIRECT_URI!

    const successUrl = `${frontendUrl}/auth/meta/success`
    const errorUrl = (msg: string) => `${frontendUrl}/auth/meta/success?error=${encodeURIComponent(msg)}`

    console.log('[Meta OAuth Callback] received', {
      has_code: !!code,
      code_length: code?.length,
      code_preview: code?.slice(0, 20),
      redirect_uri: redirectUri,
      app_id: appId,
      error_reason,
      error_description,
    })

    if (error_reason || !code) {
      const msg = error_description || error_reason || 'cancelled'
      console.error('[Meta OAuth Callback] Error from Facebook:', msg)
      return reply.redirect(errorUrl(msg))
    }

    // Troca code por short-lived token
    const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)

    console.log('[Meta OAuth Callback] exchanging code with:', {
      client_id: appId,
      redirect_uri: redirectUri,
      code_length: code.length,
    })

    const tokenRes = await fetch(tokenUrl.toString())
    const tokenData = await tokenRes.json() as { access_token?: string; error?: { message?: string; type?: string; code?: number } }
    console.log('[Meta OAuth Callback] short-lived token response:', {
      ok: !!tokenData.access_token,
      error: tokenData.error,
    })

    if (!tokenData.access_token) {
      const msg = tokenData.error?.message || 'token_exchange_failed'
      return reply.redirect(errorUrl(msg))
    }

    // Troca por long-lived token (60 dias)
    const longUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
    longUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longUrl.searchParams.set('client_id', appId)
    longUrl.searchParams.set('client_secret', appSecret)
    longUrl.searchParams.set('fb_exchange_token', tokenData.access_token)

    const longRes = await fetch(longUrl.toString())
    const longData = await longRes.json() as { access_token?: string; error?: { message?: string } }
    const finalToken = longData.access_token || tokenData.access_token
    console.log('[Meta OAuth Callback] long-lived token obtained:', !!longData.access_token)

    // Parse state
    let clientId = 'new'
    let connectionType = 'client'
    try {
      const stateData = JSON.parse(Buffer.from(state || '', 'base64url').toString())
      clientId = stateData.client_id || 'new'
      connectionType = stateData.type || 'client'
    } catch { /* ignore */ }

    console.log('[Meta OAuth Callback] saving token for:', connectionType, clientId)

    // Settings-level connection: upsert into settings table
    if (connectionType === 'settings') {
      const { data: existing, error: selectErr } = await supabase.from('settings').select('id').single()
      console.log('[Meta OAuth Callback] settings select:', { found: !!existing, error: selectErr?.message })

      let saveError: string | null = null
      if (existing) {
        const { error: updateErr } = await supabase
          .from('settings')
          .update({ meta_token: finalToken, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (updateErr) { saveError = updateErr.message; console.error('[Meta OAuth Callback] update error:', updateErr.message) }
        else console.log('[Meta OAuth Callback] settings updated successfully')
      } else {
        const { error: insertErr } = await supabase
          .from('settings')
          .insert({ meta_token: finalToken })
        if (insertErr) { saveError = insertErr.message; console.error('[Meta OAuth Callback] insert error:', insertErr.message) }
        else console.log('[Meta OAuth Callback] settings inserted successfully')
      }

      if (saveError) return reply.redirect(errorUrl('save_failed: ' + saveError))
      return reply.redirect(successUrl)
    }

    // Client-level connection
    if (clientId !== 'new') {
      const { error: clientErr } = await supabase.from('clients').update({ meta_token: finalToken }).eq('id', clientId)
      if (clientErr) console.error('[Meta OAuth Callback] client update error:', clientErr.message)
      return reply.redirect(`${successUrl}?client_id=${clientId}`)
    }

    return reply.redirect(`${frontendUrl}/clients?meta_token=${encodeURIComponent(finalToken)}`)
  })

  // ─── Manual token save ────────────────────────────────────────────────────
  fastify.post('/auth/meta/token', async (req, reply) => {
    const { token, type, client_id } = req.body as { token: string; type?: string; client_id?: string }
    const appId = process.env.META_APP_ID!
    const appSecret = process.env.META_APP_SECRET!

    if (!token) return reply.status(400).send({ message: 'Token obrigatório' })

    // Extend to long-lived token
    let finalToken = token
    try {
      const longUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
      longUrl.searchParams.set('grant_type', 'fb_exchange_token')
      longUrl.searchParams.set('client_id', appId)
      longUrl.searchParams.set('client_secret', appSecret)
      longUrl.searchParams.set('fb_exchange_token', token)
      const longRes = await fetch(longUrl.toString())
      const longData = await longRes.json() as { access_token?: string }
      if (longData.access_token) finalToken = longData.access_token
    } catch {
      // Use original token if extension fails
    }

    if (type === 'settings' || !type) {
      const { data: existing } = await supabase.from('settings').select('id').single()
      if (existing) {
        await supabase.from('settings').update({ meta_token: finalToken, updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await supabase.from('settings').insert({ meta_token: finalToken })
      }
      return { ok: true, message: 'Token salvo com sucesso' }
    }

    if (client_id) {
      await supabase.from('clients').update({ meta_token: finalToken }).eq('id', client_id)
      return { ok: true, message: 'Token salvo com sucesso' }
    }

    return reply.status(400).send({ message: 'Tipo de conexão inválido' })
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
