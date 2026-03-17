import type { FastifyPluginAsync } from 'fastify'
import { supabase } from '../lib/supabase'
import { executeAutomation, executeSingleNode } from '../jobs/executor'
import { scheduleAutomation, unscheduleAutomation } from '../jobs/scheduler'

export const automationsRoutes: FastifyPluginAsync = async (fastify) => {
  // List ALL automations across all clients (for /automacoes global page)
  fastify.get('/automations', async () => {
    const { data, error } = await supabase
      .from('automations')
      .select('*, clients(id, name)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((a) => ({
      ...a,
      client_name: (a.clients as { name: string } | null)?.name || '',
    }))
  })

  // Duplicate automation to another client
  fastify.post('/automations/:id/duplicate', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { target_client_id } = req.body as { target_client_id: string }
    if (!target_client_id) return reply.status(400).send({ message: 'target_client_id é obrigatório' })

    const { data: source, error: srcErr } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .single()
    if (srcErr || !source) return reply.status(404).send({ message: 'Automação não encontrada' })

    const { data: nodes } = await supabase.from('automation_nodes').select('*').eq('automation_id', id)
    const { data: edges } = await supabase.from('automation_edges').select('*').eq('automation_id', id)

    // Create new automation
    const { data: newAuto, error: autoErr } = await supabase
      .from('automations')
      .insert({
        client_id: target_client_id,
        name: `${source.name} (cópia)`,
        description: source.description,
        is_active: false,
      })
      .select()
      .single()
    if (autoErr || !newAuto) return reply.status(500).send({ message: 'Erro ao criar automação' })

    // Copy nodes
    if (nodes && nodes.length > 0) {
      const newNodes = nodes.map((n) => ({ ...n, automation_id: newAuto.id }))
      await supabase.from('automation_nodes').insert(newNodes)
    }

    // Copy edges
    if (edges && edges.length > 0) {
      const newEdges = edges.map((e) => ({ ...e, automation_id: newAuto.id }))
      await supabase.from('automation_edges').insert(newEdges)
    }

    return newAuto
  })

  fastify.get('/automations/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const { data: automation, error } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return reply.status(404).send({ message: 'Automação não encontrada' })

    const { data: nodes } = await supabase
      .from('automation_nodes')
      .select('*')
      .eq('automation_id', id)

    const { data: edges } = await supabase
      .from('automation_edges')
      .select('*')
      .eq('automation_id', id)

    const mappedNodes = (nodes || []).map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      config: n.config,
      position: { x: n.position_x, y: n.position_y },
    }))

    const mappedEdges = (edges || []).map((e) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      sourceHandle: e.source_handle || 'default',
      targetHandle: e.target_handle || 'default',
    }))

    return { ...automation, nodes: mappedNodes, edges: mappedEdges }
  })

  fastify.put('/automations/:id', async (req) => {
    const { id } = req.params as { id: string }
    const { nodes, edges, ...updateData } = req.body as {
      nodes?: Array<Record<string, unknown>>
      edges?: Array<Record<string, unknown>>
      [key: string]: unknown
    }

    // Update automation metadata if provided
    if (Object.keys(updateData).length > 0) {
      await supabase.from('automations').update(updateData).eq('id', id)
    }

    // Replace nodes
    if (nodes !== undefined) {
      await supabase.from('automation_nodes').delete().eq('automation_id', id)
      if (nodes.length > 0) {
        const dbNodes = nodes.map((n) => ({
          id: n.id as string,
          automation_id: id,
          type: n.type as string,
          label: n.label as string,
          config: n.config || {},
          position_x: (n.position as { x: number })?.x || 0,
          position_y: (n.position as { y: number })?.y || 0,
        }))
        await supabase.from('automation_nodes').insert(dbNodes)
      }
    }

    // Replace edges
    if (edges !== undefined) {
      await supabase.from('automation_edges').delete().eq('automation_id', id)
      if (edges.length > 0) {
        const dbEdges = edges.map((e) => ({
          id: e.id as string,
          automation_id: id,
          source_node_id: e.source as string,
          target_node_id: e.target as string,
          source_handle: e.sourceHandle || 'default',
          target_handle: e.targetHandle || 'default',
        }))
        await supabase.from('automation_edges').insert(dbEdges)
      }
    }

    return { ok: true }
  })

  fastify.delete('/automations/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await unscheduleAutomation(id)
    // Delete execution_logs first (no CASCADE on automation_id FK)
    await supabase.from('execution_logs').delete().eq('automation_id', id)
    const { error } = await supabase.from('automations').delete().eq('id', id)
    if (error) throw error
    return reply.status(204).send()
  })

  fastify.post('/automations/:id/toggle', async (req, reply) => {
    const { id } = req.params as { id: string }

    const { data: current, error: fetchError } = await supabase
      .from('automations')
      .select('is_active, automation_nodes(*)')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return reply.status(404).send({ message: 'Automação não encontrada' })
    }

    const newState = !current.is_active

    const { data, error: updateError } = await supabase
      .from('automations')
      .update({ is_active: newState })
      .eq('id', id)
      .select()
      .single()

    if (updateError || !data) {
      return reply.status(500).send({ message: 'Erro ao atualizar automação' })
    }

    // Schedule/unschedule - don't let scheduler errors break the toggle
    try {
      if (newState) {
        const nodes = (current.automation_nodes || []) as Array<{ type: string; config: Record<string, unknown> }>
        const triggerNode = nodes.find((n) => n.type === 'trigger.schedule')
        if (triggerNode) await scheduleAutomation(id, triggerNode.config)
      } else {
        await unscheduleAutomation(id)
      }
    } catch (err) {
      fastify.log.warn('Scheduler error during toggle (non-fatal):', err)
    }

    return data
  })

  fastify.post('/automations/:id/run', async (req) => {
    const { id } = req.params as { id: string }
    const executionId = await executeAutomation(id, { manual: true })
    return { executionId }
  })

  fastify.get('/automations/:id/logs', async (req) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase
      .from('execution_logs')
      .select('*')
      .eq('automation_id', id)
      .order('started_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return data || []
  })

  // Single execution by ID (used for live polling during execution)
  fastify.get('/executions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase
      .from('execution_logs')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return reply.status(404).send({ message: 'Execução não encontrada' })
    return data
  })

  fastify.post('/automations/:id/run-node', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { nodeId, inputData } = req.body as { nodeId: string; inputData?: unknown }
    if (!nodeId) return reply.status(400).send({ message: 'nodeId é obrigatório' })
    try {
      const result = await executeSingleNode(id, nodeId, inputData ?? null)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(400).send({ message })
    }
  })
}
