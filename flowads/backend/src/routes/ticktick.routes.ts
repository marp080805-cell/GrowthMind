import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

const TICKTICK_AUTH_URL = 'https://ticktick.com/oauth/authorize'
const TICKTICK_TOKEN_URL = 'https://ticktick.com/oauth/token'

function getRedirectUri(): string {
  const base = process.env.BACKEND_PUBLIC_URL || 'https://admind.zi-ai.site/backend'
  return `${base}/ticktick/callback`
}

function closePopupHtml(ok: boolean, message: string): string {
  return `<!DOCTYPE html><html><body><script>
    if (window.opener) {
      window.opener.postMessage({ type: 'ticktick_connected', ok: ${ok}, message: '${message.replace(/'/g, "\\'")}' }, '*');
    }
    window.close();
  </script><p>${ok ? 'Conectado! Pode fechar esta janela.' : `Erro: ${message}`}</p></body></html>`
}

export async function ticktickRoutes(fastify: FastifyInstance) {
  fastify.get('/ticktick/connect', async (req, reply) => {
    const { data: settings } = await supabase.from('settings').select('ticktick_client_id').single()
    if (!settings?.ticktick_client_id) {
      return reply.status(400).send({ message: 'Configure o Client ID do TickTick nas configurações primeiro.' })
    }

    const params = new URLSearchParams({
      client_id: settings.ticktick_client_id as string,
      scope: 'tasks:write tasks:read',
      redirect_uri: getRedirectUri(),
      response_type: 'code',
    })
    return reply.redirect(`${TICKTICK_AUTH_URL}?${params}`)
  })

  fastify.get('/ticktick/callback', async (req, reply) => {
    const { code, error } = req.query as { code?: string; error?: string }

    if (error || !code) {
      return reply.type('text/html').send(closePopupHtml(false, 'Autorização negada pelo usuário'))
    }

    const { data: settings } = await supabase.from('settings').select('id, ticktick_client_id, ticktick_client_secret').single()
    if (!settings?.ticktick_client_id || !settings?.ticktick_client_secret) {
      return reply.type('text/html').send(closePopupHtml(false, 'Client ID ou Client Secret não configurados'))
    }

    const credentials = Buffer.from(`${settings.ticktick_client_id}:${settings.ticktick_client_secret}`).toString('base64')

    try {
      const tokenRes = await fetch(TICKTICK_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: getRedirectUri(),
        }),
      })

      if (!tokenRes.ok) {
        const err = await tokenRes.text()
        fastify.log.error('TickTick token exchange failed:', err)
        return reply.type('text/html').send(closePopupHtml(false, 'Falha ao obter token do TickTick'))
      }

      const tokenData = await tokenRes.json() as { access_token: string; refresh_token?: string }

      await supabase
        .from('settings')
        .update({
          ticktick_token: tokenData.access_token,
          ticktick_refresh_token: tokenData.refresh_token ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id)

      return reply.type('text/html').send(closePopupHtml(true, ''))
    } catch (err) {
      fastify.log.error('TickTick OAuth error:', err)
      return reply.type('text/html').send(closePopupHtml(false, 'Erro interno ao processar autorização'))
    }
  })

  // Refresh access token using stored refresh_token
  fastify.post('/ticktick/refresh', async (req, reply) => {
    const { data: settings } = await supabase.from('settings').select('id, ticktick_client_id, ticktick_client_secret, ticktick_refresh_token').single()
    if (!settings?.ticktick_refresh_token) {
      return reply.status(400).send({ message: 'Nenhum refresh token armazenado. Reconecte o TickTick.' })
    }

    const credentials = Buffer.from(`${settings.ticktick_client_id}:${settings.ticktick_client_secret}`).toString('base64')
    const tokenRes = await fetch(TICKTICK_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: settings.ticktick_refresh_token as string,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      fastify.log.error('TickTick refresh failed:', err)
      return reply.status(400).send({ message: 'Falha ao renovar token. Reconecte o TickTick.' })
    }

    const tokenData = await tokenRes.json() as { access_token: string; refresh_token?: string }
    await supabase
      .from('settings')
      .update({
        ticktick_token: tokenData.access_token,
        ticktick_refresh_token: tokenData.refresh_token ?? settings.ticktick_refresh_token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)

    return { ok: true, message: 'Token renovado com sucesso!' }
  })
}
