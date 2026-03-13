import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'
import { supabase } from '../lib/supabase'

export const presetsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/presets', async () => {
    const { data, error } = await supabase
      .from('presets')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  })

  fastify.post('/presets/apply', async (req) => {
    const { presetId, clientId } = req.body as { presetId: string; clientId: string }

    const { data: preset, error } = await supabase.from('presets').select('*').eq('id', presetId).single()
    if (error) throw error

    // Create automation for client
    const { data: automation } = await supabase
      .from('automations')
      .insert({
        client_id: clientId,
        name: preset.name,
        description: preset.description,
        is_active: false,
      })
      .select()
      .single()

    // Import nodes
    const nodes = (preset.nodes || []) as Array<Record<string, unknown>>
    const edges = (preset.edges || []) as Array<Record<string, unknown>>

    // Generate new IDs to avoid conflicts
    const idMap = new Map<string, string>()
    const newNodes = nodes.map((n) => {
      const newId = randomUUID()
      idMap.set(n.id as string, newId)
      return {
        id: newId,
        automation_id: automation!.id,
        type: n.type as string,
        label: n.label as string,
        config: n.config || {},
        position_x: (n.position as { x: number })?.x || 0,
        position_y: (n.position as { y: number })?.y || 0,
      }
    })

    const newEdges = edges.map((e) => ({
      id: randomUUID(),
      automation_id: automation!.id,
      source_node_id: idMap.get(e.source as string) || e.source,
      target_node_id: idMap.get(e.target as string) || e.target,
      source_handle: e.sourceHandle || 'default',
      target_handle: e.targetHandle || 'default',
    }))

    if (newNodes.length > 0) await supabase.from('automation_nodes').insert(newNodes)
    if (newEdges.length > 0) await supabase.from('automation_edges').insert(newEdges)

    return automation
  })
}
