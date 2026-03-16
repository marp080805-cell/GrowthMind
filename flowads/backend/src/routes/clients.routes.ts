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
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) throw error
    return reply.status(204).send()
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

  fastify.get('/clients/:id/facebook-pages', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data: client } = await supabase.from('clients').select('meta_token').eq('id', id).single()
    if (!client?.meta_token) return reply.status(400).send({ message: 'Token Meta não configurado' })
    try {
      const meta = new MetaService(client.meta_token, '')
      const pages = await meta.getFacebookPages()
      return { pages }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar páginas'
      return reply.status(400).send({ message })
    }
  })

  // Campaigns
  fastify.get('/clients/:id/campaigns', async (req) => {
    const { id } = req.params as { id: string }

    const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
    if (!client) throw new Error('Cliente não encontrado')

    // Fallback: use global settings token if client doesn't have its own
    const token = client.meta_token || (await supabase.from('settings').select('meta_token').single()).data?.meta_token
    const adAccountId = client.ad_account_id

    if (token && adAccountId) {
      try {
        const meta = new MetaService(token, adAccountId)
        const campaigns = await meta.getCampaigns()

        // Sync to DB
        for (const campaign of campaigns) {
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
      } catch (err) {
        console.warn('Could not sync campaigns from Meta API:', err)
      }
    }

    const { data } = await supabase.from('campaigns').select('*').eq('client_id', id)
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
      return adsets
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
}
