import type { FastifyPluginAsync } from 'fastify'
import { supabase } from '../lib/supabase'
import { executeAutomation } from '../jobs/executor'

export const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // Webhook endpoint - requer autenticação obrigatória (proteção contra abuso)
  fastify.post('/webhooks/:nodeId', async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string }
    const payload = req.body

    // Find automation by node id
    const { data: node } = await supabase
      .from('automation_nodes')
      .select('automation_id, config')
      .eq('id', nodeId)
      .eq('type', 'trigger.webhook')
      .single()

    if (!node) return reply.status(404).send({ message: 'Webhook not found' })

    // Validar autenticação: exigir secret OU bearer token
    const secret = (node.config as Record<string, unknown>)?.secret
    const bearerToken = req.headers.authorization?.replace('Bearer ', '')

    if (!secret && !bearerToken) {
      return reply.status(401).send({ message: 'Autenticação obrigatória: configure x-webhook-secret ou use Authorization Bearer token' })
    }

    // Se tem secret configurado, validar
    if (secret) {
      const providedSecret = req.headers['x-webhook-secret']
      if (providedSecret !== secret) {
        return reply.status(401).send({ message: 'x-webhook-secret inválido' })
      }
    }

    // Se tem bearer token, validar contra Supabase
    if (bearerToken) {
      const { data: { user }, error } = await supabase.auth.getUser(bearerToken)
      if (error || !user) {
        return reply.status(401).send({ message: 'Bearer token inválido ou expirado' })
      }
    }

    // Check if automation is active
    const { data: automation } = await supabase
      .from('automations')
      .select('is_active')
      .eq('id', node.automation_id)
      .single()

    if (!automation?.is_active) {
      return reply.status(200).send({ message: 'Automation is paused', executed: false })
    }

    // Execute in background
    executeAutomation(node.automation_id, payload).catch((err) => {
      console.error(`[Webhook] Execution failed for automation ${node.automation_id}:`, err)
    })

    return { message: 'Webhook received', executed: true }
  })

  fastify.get('/webhooks/:nodeId', async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string }
    const payload = req.query

    const { data: node } = await supabase
      .from('automation_nodes')
      .select('automation_id, config')
      .eq('id', nodeId)
      .eq('type', 'trigger.webhook')
      .single()

    if (!node) return reply.status(404).send({ message: 'Webhook not found' })

    // Validar autenticação (mesmo como POST)
    const secret = (node.config as Record<string, unknown>)?.secret
    const bearerToken = req.headers.authorization?.replace('Bearer ', '')

    if (!secret && !bearerToken) {
      return reply.status(401).send({ message: 'Autenticação obrigatória: configure x-webhook-secret ou use Authorization Bearer token' })
    }

    if (secret) {
      const providedSecret = req.headers['x-webhook-secret']
      if (providedSecret !== secret) {
        return reply.status(401).send({ message: 'x-webhook-secret inválido' })
      }
    }

    if (bearerToken) {
      const { data: { user }, error } = await supabase.auth.getUser(bearerToken)
      if (error || !user) {
        return reply.status(401).send({ message: 'Bearer token inválido ou expirado' })
      }
    }

    const { data: automation } = await supabase
      .from('automations')
      .select('is_active')
      .eq('id', node.automation_id)
      .single()

    if (!automation?.is_active) {
      return reply.status(200).send({ message: 'Automation is paused', executed: false })
    }

    executeAutomation(node.automation_id, payload).catch(console.error)
    return { message: 'Webhook received', executed: true }
  })
}
