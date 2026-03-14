import type { FastifyPluginAsync } from 'fastify'
import { supabase } from '../lib/supabase'
import { MetaService } from '../services/meta.service'
import { OpenAIService } from '../services/openai.service'
import { AnthropicService } from '../services/anthropic.service'
import { WhatsAppService } from '../services/whatsapp.service'

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/settings', async () => {
    const { data, error } = await supabase.from('settings').select('*').single()
    if (error) {
      // Return defaults if not configured
      return { available_models: getDefaultModels() }
    }
    return data
  })

  fastify.put('/settings', async (req) => {
    const body = req.body as Record<string, unknown>

    const { data: existing } = await supabase.from('settings').select('id').single()

    if (existing) {
      const { data, error } = await supabase
        .from('settings')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return data
    } else {
      const { data, error } = await supabase
        .from('settings')
        .insert({ ...body, updated_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return data
    }
  })

  fastify.post('/settings/test/:service', async (req) => {
    const { service } = req.params as { service: string }
    const body = req.body as Record<string, unknown>
    const { data: dbSettings } = await supabase.from('settings').select('*').single()
    // Merge DB settings with values passed directly in the request body (form values take priority)
    const settings = { ...dbSettings, ...body }

    try {
      switch (service) {
        case 'meta': {
          if (!settings?.meta_token) throw new Error('Token Meta não configurado')
          const meta = new MetaService(settings.meta_token as string, '')
          await meta.validateToken()
          return { ok: true, message: 'Meta API conectada com sucesso!' }
        }
        case 'openai': {
          if (!settings?.openai_key) throw new Error('OpenAI API key não configurada')
          const openai = new OpenAIService(settings.openai_key as string)
          await openai.complete({
            model: 'gpt-4o-mini',
            systemPrompt: 'test',
            humanMessage: 'Say ok',
            temperature: 0,
            maxTokens: 5,
            outputFormat: 'text',
          })
          return { ok: true, message: 'OpenAI conectada com sucesso!' }
        }
        case 'anthropic': {
          if (!settings?.anthropic_key) throw new Error('Anthropic API key não configurada')
          const anthropic = new AnthropicService(settings.anthropic_key as string)
          await anthropic.complete({
            model: 'claude-haiku-4-5',
            systemPrompt: 'test',
            humanMessage: 'Say ok',
            temperature: 0,
            maxTokens: 5,
            outputFormat: 'text',
          })
          return { ok: true, message: 'Anthropic conectada com sucesso!' }
        }
        case 'whatsapp': {
          if (!settings?.whatsapp_url || !settings?.whatsapp_token) {
            throw new Error('WhatsApp API não configurada')
          }
          const wa = new WhatsAppService(settings.whatsapp_url as string, settings.whatsapp_token as string)
          await wa.sendMessage(
            settings.whatsapp_number || '5511999999999',
            '✅ FlowAds: conexão testada com sucesso!'
          )
          return { ok: true, message: 'WhatsApp conectado com sucesso!' }
        }
        default:
          return { ok: false, message: 'Serviço desconhecido' }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao testar conexão'
      return { ok: false, message }
    }
  })

  fastify.get('/settings/models', async () => {
    const { data: settings } = await supabase.from('settings').select('available_models').single()
    return settings?.available_models || getDefaultModels()
  })

  fastify.put('/settings/models', async (req) => {
    const { models } = req.body as { models: unknown[] }
    const { data: existing } = await supabase.from('settings').select('id').single()

    if (existing) {
      await supabase.from('settings').update({ available_models: models }).eq('id', existing.id)
    } else {
      await supabase.from('settings').insert({ available_models: models })
    }

    return models
  })
}

// Dashboard route
export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dashboard/stats', async () => {
    const [
      { count: activeClients },
      { count: runningAutomations },
      { count: executionsToday },
      { count: errors24h },
    ] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('automations').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('execution_logs').select('*', { count: 'exact', head: true })
        .gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from('execution_logs').select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('started_at', new Date(Date.now() - 86400000).toISOString()),
    ])

    return {
      active_clients: activeClients || 0,
      running_automations: runningAutomations || 0,
      executions_today: executionsToday || 0,
      errors_24h: errors24h || 0,
    }
  })

  fastify.get('/dashboard/executions', async () => {
    const { data } = await supabase
      .from('execution_logs')
      .select('*, automations(name, clients(name))')
      .order('started_at', { ascending: false })
      .limit(20)

    return (data || []).map((log) => ({
      id: log.id,
      automation_name: (log.automations as { name?: string } | null)?.name || 'Desconhecida',
      client_name: ((log.automations as { clients?: { name?: string } | null } | null)?.clients as { name?: string } | null)?.name || 'Desconhecido',
      status: log.status,
      started_at: log.started_at,
      duration_ms: log.finished_at
        ? new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()
        : null,
    }))
  })
}

function getDefaultModels() {
  return [
    { id: 'gpt-4o', provider: 'openai', slug: 'gpt-4o', display_name: 'GPT-4o', is_active: true },
    { id: 'gpt-4o-mini', provider: 'openai', slug: 'gpt-4o-mini', display_name: 'GPT-4o Mini', is_active: true },
    { id: 'o1', provider: 'openai', slug: 'o1', display_name: 'o1', is_active: true },
    { id: 'o1-mini', provider: 'openai', slug: 'o1-mini', display_name: 'o1 Mini', is_active: true },
    { id: 'o3-mini', provider: 'openai', slug: 'o3-mini', display_name: 'o3 Mini', is_active: true },
    { id: 'claude-opus-4-5', provider: 'anthropic', slug: 'claude-opus-4-5', display_name: 'Claude Opus 4.5', is_active: true },
    { id: 'claude-sonnet-4-5', provider: 'anthropic', slug: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', is_active: true },
    { id: 'claude-haiku-4-5', provider: 'anthropic', slug: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5', is_active: true },
    { id: 'claude-sonnet-4-6', provider: 'anthropic', slug: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6', is_active: true },
  ]
}
