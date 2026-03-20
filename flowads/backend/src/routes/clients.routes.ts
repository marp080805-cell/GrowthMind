import type { FastifyPluginAsync } from 'fastify'
import { supabase } from '../lib/supabase'
import { MetaService } from '../services/meta.service'
import type { MetaInstagramAccount } from '../services/meta.service'

export const clientsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/clients', async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*, automations(count)')
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((c) => ({
      ...c,
      automations_count: c.automations?.[0]?.count || 0,
    }))
  })

  fastify.post('/clients', async (req) => {
    const body = req.body as Record<string, unknown>
    const { data, error } = await supabase.from('clients').insert(body).select().single()
    if (error) throw error
    return data
  })

  fastify.get('/clients/:id', async (req) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
    if (error) throw error
    return data
  })

  fastify.put('/clients/:id', async (req) => {
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>
    const { data, error } = await supabase.from('clients').update(body).eq('id', id).select().single()
    if (error) throw error
    return data
  })

  fastify.delete('/clients/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    try {
      // 1. Get all automation IDs
      const { data: automations } = await supabase.from('automations').select('id').eq('client_id', id)
      const automationIds = (automations || []).map((a: { id: string }) => a.id)

      if (automationIds.length > 0) {
        // 2. Get all execution log IDs for these automations
        const { data: logs } = await supabase.from('execution_logs').select('id').in('automation_id', automationIds)
        const logIds = (logs || []).map((l: { id: string }) => l.id)

        // 3. Delete agent_memory FIRST (references execution_logs.id AND clients.id — no CASCADE)
        if (logIds.length > 0) {
          const { error: e1 } = await supabase.from('agent_memory').delete().in('execution_id', logIds)
          if (e1) console.error('[delete client] agent_memory by execution_id:', e1.message)
        }

        // 4. Delete execution_logs (now safe)
        const { error: e2 } = await supabase.from('execution_logs').delete().in('automation_id', automationIds)
        if (e2) console.error('[delete client] execution_logs:', e2.message)

        // 5. Delete nodes and edges
        await supabase.from('automation_nodes').delete().in('automation_id', automationIds)
        await supabase.from('automation_edges').delete().in('automation_id', automationIds)

        // 6. Delete automations
        await supabase.from('automations').delete().in('id', automationIds)
      }

      // 7. Delete remaining agent_memory by client_id (in case client_id differs from execution-based ones)
      await supabase.from('agent_memory').delete().eq('client_id', id)

      // 8. Delete agents, campaigns, sponsored_posts
      await supabase.from('agents').delete().eq('client_id', id)
      await supabase.from('campaigns').delete().eq('client_id', id)
      await supabase.from('sponsored_posts').delete().eq('client_id', id)

      // 9. Finally delete the client
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) {
        console.error('[delete client] clients:', error.message)
        throw error
      }
      return reply.status(204).send()
    } catch (err) {
      console.error('[delete client] FATAL:', err)
      throw err
    }
  })

  fastify.get('/clients/:id/meta-accounts', async (req, reply) => {
    const { id } = req.params as { id: string }

    const { data: client } = await supabase.from('clients').select('meta_token').eq('id', id).single()
    if (!client?.meta_token) return reply.status(400).send({ message: 'Token Meta não configurado para este cliente' })

    try {
      const meta = new MetaService(client.meta_token, '')
      const { accounts } = await meta.validateToken()
      const adAccountIds = accounts.map(a => a.id)
      const instagramAccounts = await meta.getInstagramAccounts(adAccountIds).catch(() => [] as MetaInstagramAccount[])
      return { accounts, instagramAccounts }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar contas Meta'
      return reply.status(400).send({ message })
    }
  })

  fastify.post('/clients/:id/connect-meta', async (req, reply) => {
    const { token } = req.body as { token: string }

    try {
      const meta = new MetaService(token, '')
      const { accounts } = await meta.validateToken()
      const adAccountIds = accounts.map(a => a.id)
      const instagramAccounts = await meta.getInstagramAccounts(adAccountIds).catch(() => [] as MetaInstagramAccount[])
      return { accounts, instagramAccounts }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token inválido'
      return reply.status(400).send({ message })
    }
  })

  fastify.post('/clients/:id/instagram-accounts', async (req, reply) => {
    const { token, ad_account_id } = req.body as { token: string; ad_account_id: string }

    try {
      const meta = new MetaService(token, ad_account_id)
      const instagramAccounts = await meta.getInstagramAccounts()
      return { instagram_accounts: instagramAccounts }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar contas Instagram'
      return reply.status(400).send({ message })
    }
  })

  // GET — busca contas Instagram que podem ser usadas como instagram_actor_id em anúncios
  fastify.get('/clients/:id/instagram-accounts', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data: client } = await supabase
      .from('clients')
      .select('meta_token, instagram_account_id, ad_account_id, facebook_page_id')
      .eq('id', id)
      .single()

    const token = client?.meta_token
    const seen = new Set<string>()
    const accounts: { id: string; name: string; username: string }[] = []
    const add = (a: { id: string; name: string; username: string }) => {
      if (!seen.has(a.id)) { seen.add(a.id); accounts.push(a) }
    }

    // Tentativa 1: via Página do Facebook — retorna as contas Instagram "atores" da página
    // Este endpoint retorna o ID usado pelo Ads Manager (ex: 1916293021718740)
    if (token && client?.facebook_page_id) {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${client.facebook_page_id}/instagram_accounts?fields=id,name,username&access_token=${token}`)
        if (res.ok) {
          const data = await res.json() as { data?: { id: string; name: string; username: string }[] }
          if (data.data?.length) data.data.forEach(add)
        }
      } catch { /* tenta próximo */ }
    }

    // Tentativa 2: via conta de anúncios
    if (token && client?.ad_account_id) {
      try {
        const actId = client.ad_account_id.startsWith('act_') ? client.ad_account_id : `act_${client.ad_account_id}`
        const res = await fetch(`https://graph.facebook.com/v21.0/${actId}/instagram_accounts?fields=id,name,username&access_token=${token}`)
        if (res.ok) {
          const data = await res.json() as { data?: { id: string; name: string; username: string }[] }
          if (data.data?.length) data.data.forEach(add)
        }
      } catch { /* tenta próximo */ }
    }

    // Fallback: usa o instagram_account_id salvo no cliente
    if (accounts.length === 0 && client?.instagram_account_id) {
      if (token) {
        try {
          const res = await fetch(`https://graph.facebook.com/v21.0/${client.instagram_account_id}?fields=id,name,username&access_token=${token}`)
          if (res.ok) {
            const data = await res.json() as { id?: string; name?: string; username?: string }
            add({ id: data.id || client.instagram_account_id, name: data.name || '', username: data.username || client.instagram_account_id })
          }
        } catch { /* ignora */ }
      }
      if (accounts.length === 0) {
        add({ id: client.instagram_account_id, name: '', username: client.instagram_account_id })
      }
    }

    return { instagram_accounts: accounts }
  })

  fastify.get('/clients/:id/facebook-pages', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data: client } = await supabase.from('clients').select('meta_token').eq('id', id).single()
    const token = client?.meta_token || (await supabase.from('settings').select('meta_token').single()).data?.meta_token
    if (!token) return reply.status(400).send({ message: 'Token Meta não configurado' })
    try {
      const meta = new MetaService(token, '')
      const pages = await meta.getFacebookPages()
      return { pages }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar páginas'
      return reply.status(400).send({ message })
    }
  })

  // Campaigns — read from DB (fast, no Meta API call)
  fastify.get('/clients/:id/campaigns', async (req) => {
    const { id } = req.params as { id: string }
    const { data } = await supabase.from('campaigns').select('*').eq('client_id', id).eq('status', 'ACTIVE').order('name', { ascending: true })
    return data || []
  })

  // Campaigns sync — fetch from Meta API, update DB, return active
  fastify.post('/clients/:id/campaigns/sync', async (req, reply) => {
    const { id } = req.params as { id: string }

    const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
    if (!client) return reply.status(404).send({ message: 'Cliente não encontrado' })

    const token = client.meta_token || (await supabase.from('settings').select('meta_token').single()).data?.meta_token
    const adAccountId = client.ad_account_id

    if (!token || !adAccountId) return reply.status(400).send({ message: 'Token Meta ou Ad Account não configurado' })

    const meta = new MetaService(token, adAccountId)
    const allCampaigns = await meta.getCampaigns()

    const activeCampaigns = allCampaigns.filter((c) => c.status === 'ACTIVE')
    const activeIds = activeCampaigns.map((c) => c.id)

    for (const campaign of activeCampaigns) {
      await supabase.from('campaigns').upsert({
        client_id: id,
        meta_campaign_id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        budget: campaign.daily_budget ? parseInt(campaign.daily_budget) / 100 : 0,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'client_id,meta_campaign_id' })
    }

    // Remove campaigns no longer active from DB
    if (activeIds.length > 0) {
      await supabase.from('campaigns').delete()
        .eq('client_id', id)
        .not('meta_campaign_id', 'in', `(${activeIds.map((i) => `"${i}"`).join(',')})`)
    } else {
      await supabase.from('campaigns').delete().eq('client_id', id)
    }

    const { data } = await supabase.from('campaigns').select('*').eq('client_id', id).eq('status', 'ACTIVE').order('name', { ascending: true })
    return data || []
  })

  fastify.get('/clients/:id/adsets', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { campaign_id } = req.query as { campaign_id?: string }
    if (!campaign_id) return reply.status(400).send({ message: 'campaign_id obrigatório' })

    const { data: client } = await supabase.from('clients').select('meta_token, ad_account_id').eq('id', id).single()
    if (!client?.ad_account_id) return reply.status(400).send({ message: 'Cliente sem ad_account_id configurado' })

    // Fallback: use global settings token if client doesn't have its own
    const token = client.meta_token || (await supabase.from('settings').select('meta_token').single()).data?.meta_token
    if (!token) return reply.status(400).send({ message: 'Token Meta não configurado' })

    try {
      const meta = new MetaService(token, client.ad_account_id)
      const adsets = await meta.getAdSets(campaign_id)
      return adsets.filter((a) => a.status === 'ACTIVE')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar adsets'
      return reply.status(400).send({ message })
    }
  })

  fastify.put('/clients/:id/campaigns/:campaignId/context', async (req) => {
    const { campaignId } = req.params as { id: string; campaignId: string }
    const { context } = req.body as { context: string }
    const { data, error } = await supabase.from('campaigns').update({ context }).eq('id', campaignId).select().single()
    if (error) throw error
    return data
  })

  // Automations
  fastify.get('/clients/:id/automations', async (req) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  })

  fastify.post('/clients/:id/automations', async (req) => {
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>
    const { nodes, edges, ...automationData } = body

    const { data: automation, error } = await supabase
      .from('automations')
      .insert({ ...automationData, client_id: id })
      .select()
      .single()
    if (error) throw error

    // Insert nodes and edges if provided
    if (nodes && Array.isArray(nodes)) {
      const dbNodes = (nodes as Record<string, unknown>[]).map((n) => ({
        id: n.id,
        automation_id: automation.id,
        type: n.type,
        label: n.label,
        config: n.config,
        position_x: (n.position as { x: number; y: number })?.x || 0,
        position_y: (n.position as { x: number; y: number })?.y || 0,
      }))
      await supabase.from('automation_nodes').insert(dbNodes)
    }

    return automation
  })

  // Agents
  fastify.get('/clients/:id/agents', async (req) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase.from('agents').select('*').eq('client_id', id)
    if (error) throw error
    return data || []
  })

  fastify.post('/clients/:id/agents', async (req) => {
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>
    const { data, error } = await supabase.from('agents').insert({ ...body, client_id: id }).select().single()
    if (error) throw error
    return data
  })

  fastify.put('/clients/:id/agents/:agentId', async (req) => {
    const { agentId } = req.params as { id: string; agentId: string }
    const body = req.body as Record<string, unknown>
    const { data, error } = await supabase.from('agents').update(body).eq('id', agentId).select().single()
    if (error) throw error
    return data
  })

  fastify.delete('/clients/:id/agents/:agentId', async (req, reply) => {
    const { agentId } = req.params as { id: string; agentId: string }
    const { error } = await supabase.from('agents').delete().eq('id', agentId)
    if (error) throw error
    return reply.status(204).send()
  })

  // List ALL agents across all clients (for /agentes global page)
  fastify.get('/agents', async () => {
    const { data, error } = await supabase
      .from('agents')
      .select('*, clients(id, name)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((a) => ({
      ...a,
      client_name: (a.clients as { name: string } | null)?.name || '',
    }))
  })
}
