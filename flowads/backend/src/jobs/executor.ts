import { supabase } from '../lib/supabase'
import type {
  AutomationNode, AutomationEdge, ExecutionContext,
  NodeLog, ExecutionLog, Client, Campaign, Settings, ScoringRule, ScoringConfig
} from '../lib/types'
import { MetaService } from '../services/meta.service'
import { OpenAIService } from '../services/openai.service'
import { AnthropicService } from '../services/anthropic.service'
import { WhatsAppService } from '../services/whatsapp.service'

function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const keys = key.trim().split('.')
    let val: unknown = vars
    for (const k of keys) {
      const arrayMatch = k.match(/^\[(\d+)\]$/)
      const keyWithIndex = k.match(/^([^\[]+)\[(\d+)\]$/)
      if (arrayMatch) {
        val = (val as unknown[])?.[parseInt(arrayMatch[1])]
      } else if (keyWithIndex) {
        val = ((val as Record<string, unknown>)?.[keyWithIndex[1]] as unknown[])?.[parseInt(keyWithIndex[2])]
      } else {
        val = (val as Record<string, unknown>)?.[k]
      }
    }
    if (val === undefined || val === null) return ''
    if (Array.isArray(val)) {
      return val.map(item =>
        item && typeof item === 'object' ? JSON.stringify(item) : String(item)
      ).join('\n')
    }
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  })
}

function resolvePureVar(template: string, vars: Record<string, unknown>): unknown | undefined {
  const m = template.match(/^\{\{([^}]+)\}\}$/)
  if (!m) return undefined
  const keys = m[1].trim().split('.')
  let val: unknown = vars
  for (const k of keys) val = (val as Record<string, unknown>)?.[k]
  return val
}

function interpolateConfig(config: Record<string, unknown>, vars: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'string') {
      // Preserve original type when the entire value is a single {{var}} template
      const raw = resolvePureVar(v, vars)
      if (raw !== undefined && raw !== null && typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') {
        result[k] = raw
      } else {
        result[k] = interpolate(v, vars)
      }
    } else if (Array.isArray(v)) {
      result[k] = v.map(item =>
        typeof item === 'string' ? interpolate(item, vars)
        : (item && typeof item === 'object') ? interpolateConfig(item as Record<string, unknown>, vars)
        : item
      )
    } else if (typeof v === 'object' && v !== null) {
      result[k] = interpolateConfig(v as Record<string, unknown>, vars)
    } else {
      result[k] = v
    }
  }
  return result
}

function buildTopologicalOrder(
  nodes: AutomationNode[],
  edges: AutomationEdge[],
  triggerNodeId: string
): AutomationNode[] {
  const visited = new Set<string>()
  const order: AutomationNode[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const outgoing = edges.filter((e) => e.source === id || e.source_node_id === id)
    for (const edge of outgoing) {
      const targetId = edge.target || edge.target_node_id!
      visit(targetId)
    }
    const node = nodeMap.get(id)
    if (node) order.unshift(node)
  }

  visit(triggerNodeId)
  return order
}

async function getSettings(): Promise<Settings> {
  const { data } = await supabase.from('settings').select('*').single()
  return data as Settings
}

async function getClient(clientId: string): Promise<Client> {
  const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
  return data as Client
}

async function getCampaigns(clientId: string): Promise<Campaign[]> {
  const { data } = await supabase.from('campaigns').select('*').eq('client_id', clientId)
  return (data || []) as Campaign[]
}

export async function executeAutomation(
  automationId: string,
  triggerPayload?: unknown
): Promise<string> {
  // Create execution log
  const { data: logRecord } = await supabase
    .from('execution_logs')
    .insert({
      automation_id: automationId,
      status: 'running',
      log_data: [],
    })
    .select()
    .single()

  if (!logRecord) throw new Error('Falha ao criar registro de execução')

  const executionId = logRecord.id
  const nodeLogs: NodeLog[] = []

  async function updateLog(status: 'running' | 'success' | 'error') {
    await supabase.from('execution_logs').update({
      status,
      finished_at: status !== 'running' ? new Date().toISOString() : undefined,
      log_data: nodeLogs,
    }).eq('id', executionId)
  }

  try {
    // Load automation data
    const { data: automation } = await supabase
      .from('automations')
      .select('*, automation_nodes(*), automation_edges(*)')
      .eq('id', automationId)
      .single()

    if (!automation) throw new Error('Automação não encontrada')

    const { data: client } = automation.client_id
      ? await supabase.from('clients').select('*').eq('id', automation.client_id).single()
      : { data: null }
    const campaigns = automation.client_id ? await getCampaigns(automation.client_id) : []
    const settings = await getSettings()

    const context: ExecutionContext = {
      client: client as Client,
      campaigns,
      settings: settings || ({} as Settings),
      executionId,
      triggerPayload,
    }

    const nodes = (automation.automation_nodes || []) as AutomationNode[]
    const edges = (automation.automation_edges || []) as AutomationEdge[]

    // Find trigger node
    const triggerNode = nodes.find((n) => n.type.startsWith('trigger.'))
    if (!triggerNode) throw new Error('Nenhum nó de trigger encontrado na automação')

    // Build execution order
    const ordered = buildTopologicalOrder(nodes, edges, triggerNode.id)

    // Build template vars
    const templateVars: Record<string, unknown> = {
      hoje: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      amanha: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) })(),
      'amanhã': (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) })(),
      amanha_iso: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })(),
      semana_atual: `semana de ${getWeekRange()}`,
      mes_atual: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long' }),
      data_formatada: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' }),
      cliente: client ? {
        nome: client.name,
        tipo_negocio: client.business_type,
        contexto: client.context,
        whatsapp: client.whatsapp,
        instagram_account_id: client.instagram_account_id || '',
      } : {},
      campanhas: {
        todas: context.campaigns,
      },
      input: triggerPayload,
    }

    let lastOutput: unknown = triggerPayload

    // Nodes that belong to a loop body — handled inline, skip in main pass
    const loopBodyNodes = new Set<string>()
    // Nodes on inactive IF branches — skip these
    const skippedBranchNodes = new Set<string>()

    // Execute each node
    for (const node of ordered) {
      if (loopBodyNodes.has(node.id)) continue

      // Skip nodes on inactive IF branches
      if (skippedBranchNodes.has(node.id)) {
        nodeLogs.push({
          node_id: node.id,
          node_type: node.type,
          node_label: node.label || node.type,
          status: 'skipped',
          input: lastOutput,
          output: null,
          duration_ms: 0,
        })
        await updateLog('running')
        continue
      }

      // Skip disabled nodes — pass input through unchanged
      if (node.config?._disabled === true) {
        nodeLogs.push({
          node_id: node.id,
          node_type: node.type,
          node_label: node.label || node.type,
          status: 'skipped',
          input: lastOutput,
          output: lastOutput,
          duration_ms: 0,
        })
        await updateLog('running')
        continue
      }

      if (node.type.startsWith('trigger.')) {
        // Triggers are just starting points
        // For instagram trigger, inject client's instagram_account_id as fallback
        const triggerOutput = node.type === 'trigger.instagram'
          ? {
              ...(triggerPayload as Record<string, unknown> || {}),
              instagram_account_id: (triggerPayload as Record<string, unknown>)?.instagram_account_id
                || context.client?.instagram_account_id
                || '',
            }
          : triggerPayload

        nodeLogs.push({
          node_id: node.id,
          node_type: node.type,
          node_label: node.label || node.type,
          status: 'success',
          input: triggerPayload,
          output: triggerOutput,
          duration_ms: 0,
        })
        lastOutput = triggerOutput
        templateVars.input = triggerOutput
        // Flatten trigger output so top-level keys (data, source, etc.) são acessíveis diretamente
        if (triggerOutput && typeof triggerOutput === 'object') {
          Object.assign(templateVars, flattenOutput(triggerOutput as Record<string, unknown>))
        }
        // Alias: {{body...}} aponta para o payload do webhook
        if (node.type === 'trigger.webhook') {
          templateVars.body = triggerOutput
        }
        continue
      }

      const startTime = Date.now()
      const interpolatedConfig = interpolateConfig(node.config, templateVars)

      const inputSnapshot = lastOutput
      try {
        const output = await executeNode(node, interpolatedConfig, lastOutput, context)
        const duration = Date.now() - startTime

        lastOutput = output
        templateVars.input = output

        // Add nested keys if object
        if (output && typeof output === 'object') {
          Object.assign(templateVars, { ...templateVars, ...flattenOutput(output as Record<string, unknown>) })
        }

        nodeLogs.push({
          node_id: node.id,
          node_type: node.type,
          node_label: node.label || node.type,
          status: 'success',
          input: inputSnapshot,
          output,
          duration_ms: duration,
        })

        // ── IF: mark inactive branch nodes as skipped ───────────────────────
        if (node.type === 'logic.if') {
          const ifResult = output as { condition: boolean; input: unknown }
          const activeHandle = ifResult.condition ? 'yes' : 'no'
          const inactiveHandle = ifResult.condition ? 'no' : 'yes'

          // Normalize legacy 'true'/'false' handles to 'yes'/'no'
          const normalizeHandle = (h: string | undefined | null) =>
            h === 'true' ? 'yes' : h === 'false' ? 'no' : (h ?? 'default')

          const matchesHandle = (e: AutomationEdge, handle: string) => {
            const sh = normalizeHandle(e.sourceHandle ?? e.source_handle)
            return (e.source === node.id || e.source_node_id === node.id) && sh === handle
          }

          // Collect all nodes reachable from active handle (to protect them)
          const activeTargets = edges
            .filter(e => matchesHandle(e, activeHandle))
            .map(e => e.target || e.target_node_id || '').filter(Boolean)
          const activeReachable = new Set<string>()
          const activeBfs = [...activeTargets]
          while (activeBfs.length > 0) {
            const nid = activeBfs.shift()!
            if (activeReachable.has(nid)) continue
            activeReachable.add(nid)
            edges.filter(e => e.source === nid || e.source_node_id === nid)
              .forEach(e => { const t = e.target || e.target_node_id || ''; if (t) activeBfs.push(t) })
          }

          // Collect inactive branch nodes (not reachable from active handle)
          const inactiveTargets = edges
            .filter(e => matchesHandle(e, inactiveHandle))
            .map(e => e.target || e.target_node_id || '').filter(Boolean)
          const inactiveBfs = [...inactiveTargets]
          while (inactiveBfs.length > 0) {
            const nid = inactiveBfs.shift()!
            if (skippedBranchNodes.has(nid) || activeReachable.has(nid)) continue
            skippedBranchNodes.add(nid)
            edges.filter(e => e.source === nid || e.source_node_id === nid)
              .forEach(e => { const t = e.target || e.target_node_id || ''; if (t && !activeReachable.has(t)) inactiveBfs.push(t) })
          }

          // Pass the original input through, preserving `condition` key so
          // stop nodes on inactive branches can detect they should be skipped.
          const ifBaseInput = (ifResult.input && typeof ifResult.input === 'object')
            ? (ifResult.input as Record<string, unknown>)
            : {}
          lastOutput = { ...ifBaseInput, condition: ifResult.condition }
          templateVars.input = lastOutput
          Object.assign(templateVars, flattenOutput(ifBaseInput))
        }
        // ────────────────────────────────────────────────────────────────────

        // ── Switch: route to matched case, skip all others ───────────────────
        if (node.type === 'logic.switch') {
          const switchResult = output as { matched_case: string; input: unknown }
          const matchedHandle = switchResult.matched_case
          const switchEdgeHandles = [...new Set(
            edges.filter(e => e.source === node.id || e.source_node_id === node.id)
              .map(e => e.sourceHandle || e.source_handle || 'default')
          )]
          const inactiveHandles = switchEdgeHandles.filter(h => h !== matchedHandle)

          // Protect nodes reachable from matched handle
          const activeTargets = edges
            .filter(e => (e.source === node.id || e.source_node_id === node.id) &&
                         (e.sourceHandle === matchedHandle || e.source_handle === matchedHandle))
            .map(e => e.target || e.target_node_id || '').filter(Boolean)
          const activeReachable = new Set<string>()
          const activeBfs = [...activeTargets]
          while (activeBfs.length > 0) {
            const nid = activeBfs.shift()!
            if (activeReachable.has(nid)) continue
            activeReachable.add(nid)
            edges.filter(e => e.source === nid || e.source_node_id === nid)
              .forEach(e => { const t = e.target || e.target_node_id || ''; if (t) activeBfs.push(t) })
          }

          // Skip all inactive branches
          for (const h of inactiveHandles) {
            const targets = edges
              .filter(e => (e.source === node.id || e.source_node_id === node.id) &&
                           (e.sourceHandle === h || e.source_handle === h))
              .map(e => e.target || e.target_node_id || '').filter(Boolean)
            const bfs = [...targets]
            while (bfs.length > 0) {
              const nid = bfs.shift()!
              if (skippedBranchNodes.has(nid) || activeReachable.has(nid)) continue
              skippedBranchNodes.add(nid)
              edges.filter(e => e.source === nid || e.source_node_id === nid)
                .forEach(e => { const t = e.target || e.target_node_id || ''; if (t && !activeReachable.has(t)) bfs.push(t) })
            }
          }

          const switchBaseInput = (switchResult.input && typeof switchResult.input === 'object')
            ? (switchResult.input as Record<string, unknown>)
            : {}
          lastOutput = { ...switchBaseInput, matched_case: matchedHandle }
          templateVars.input = lastOutput
          Object.assign(templateVars, flattenOutput(switchBaseInput))
        }
        // ────────────────────────────────────────────────────────────────────

        // ── Loop: execute "each" branch for every item ──────────────────────
        if (node.type === 'logic.loop') {
          const loopResult = output as { items: unknown[]; total: number; item_var: string }
          const items = loopResult.items || []
          const itemVar = loopResult.item_var || 'item'
          const batchSize = Math.max(1, (interpolatedConfig.batch_size as number) || 1)
          const totalBatches = Math.ceil(items.length / batchSize)

          // Collect nodes reachable via "each" edges (BFS)
          const eachTargets = edges
            .filter(e => (e.source === node.id || e.source_node_id === node.id) &&
                         (e.sourceHandle === 'each' || e.source_handle === 'each'))
            .map(e => e.target || e.target_node_id || '').filter(Boolean)

          const bodyNodeIds = new Set<string>()
          const bfsQueue = [...eachTargets]
          while (bfsQueue.length > 0) {
            const nid = bfsQueue.shift()!
            if (bodyNodeIds.has(nid) || nid === node.id) continue // don't add the Loop node itself (prevents cycles)
            bodyNodeIds.add(nid)
            edges
              .filter(e => e.source === nid || e.source_node_id === nid)
              .forEach(e => { const t = e.target || e.target_node_id || ''; if (t) bfsQueue.push(t) })
          }

          // Mark body nodes so main loop skips them
          for (const id of bodyNodeIds) loopBodyNodes.add(id)

          // Body nodes in original topological order
          const bodyNodesOrdered = ordered.filter(n => bodyNodeIds.has(n.id))

          // Execute each batch through the body
          let batchIndex = 0
          const loopResults: unknown[] = []
          for (let i = 0; i < items.length; i += batchSize) {
            batchIndex++
            const batch = items.slice(i, i + batchSize)
            const item = batchSize === 1 ? batch[0] : batch
            const iterLabel = `[${batchIndex}/${totalBatches}]`
            const iterVars: Record<string, unknown> = { ...templateVars, [itemVar]: item, loop_index: batchIndex - 1, loop_batch_size: batchSize }
            let iterLastOutput: unknown = item
            const iterSkipped = new Set<string>()

            for (const bodyNode of bodyNodesOrdered) {
              if (iterSkipped.has(bodyNode.id)) {
                nodeLogs.push({ node_id: bodyNode.id, node_type: bodyNode.type, node_label: `${bodyNode.label || bodyNode.type} ${iterLabel}`, status: 'skipped', input: iterLastOutput, output: null, duration_ms: 0 })
                continue
              }

              const iterStart = Date.now()
              const iterConfig = interpolateConfig(bodyNode.config, iterVars)
              const iterInputSnapshot = iterLastOutput
              try {
                const iterOutput = await executeNode(bodyNode, iterConfig, iterLastOutput, context)
                const iterDuration = Date.now() - iterStart

                // Branch routing for IF/Switch inside loop body
                const normalizeHandle = (h: string | undefined | null) =>
                  h === 'true' ? 'yes' : h === 'false' ? 'no' : (h ?? 'default')

                if (bodyNode.type === 'logic.if') {
                  const ifResult = iterOutput as { condition: boolean; input: unknown }
                  const activeHandle = ifResult.condition ? 'yes' : 'no'
                  const inactiveHandle = ifResult.condition ? 'no' : 'yes'
                  const matchesIF = (e: AutomationEdge, handle: string) =>
                    (e.source === bodyNode.id || e.source_node_id === bodyNode.id) &&
                    normalizeHandle(e.sourceHandle ?? e.source_handle) === handle
                  const activeReachable = new Set<string>()
                  // Filter seeds to bodyNodeIds — prevents back-edges to Loop from polluting activeReachable
                  const activeBfs = edges.filter(e => matchesIF(e, activeHandle)).map(e => e.target || e.target_node_id || '').filter(t => t && bodyNodeIds.has(t))
                  while (activeBfs.length > 0) {
                    const nid = activeBfs.shift()!
                    if (activeReachable.has(nid)) continue
                    activeReachable.add(nid)
                    edges.filter(e => e.source === nid || e.source_node_id === nid).forEach(e => { const t = e.target || e.target_node_id || ''; if (t && bodyNodeIds.has(t)) activeBfs.push(t) })
                  }
                  // Filter seeds to bodyNodeIds — prevents back-edges to Loop from marking upstream nodes as inactive
                  const inactiveTargets = edges.filter(e => matchesIF(e, inactiveHandle)).map(e => e.target || e.target_node_id || '').filter(t => t && bodyNodeIds.has(t))
                  const inactiveBfs = [...inactiveTargets]
                  while (inactiveBfs.length > 0) {
                    const nid = inactiveBfs.shift()!
                    if (iterSkipped.has(nid) || activeReachable.has(nid)) continue
                    iterSkipped.add(nid)
                    edges.filter(e => e.source === nid || e.source_node_id === nid).forEach(e => { const t = e.target || e.target_node_id || ''; if (t && !activeReachable.has(t) && bodyNodeIds.has(t)) inactiveBfs.push(t) })
                  }
                  const ifBaseInput = (ifResult.input && typeof ifResult.input === 'object') ? (ifResult.input as Record<string, unknown>) : {}
                  iterLastOutput = { ...ifBaseInput, condition: ifResult.condition }
                } else if (bodyNode.type === 'logic.switch') {
                  const switchResult = iterOutput as { matched_case: string; input: unknown }
                  const matchedHandle = switchResult.matched_case
                  const switchOutEdges = edges.filter(e => e.source === bodyNode.id || e.source_node_id === bodyNode.id)
                  const switchEdgeHandles = [...new Set(switchOutEdges.map(e => e.sourceHandle || e.source_handle || 'default'))]
                  const inactiveHandles = switchEdgeHandles.filter(h => h !== matchedHandle)
                  const activeReachable = new Set<string>()
                  // Filter seeds to bodyNodeIds — prevents back-edges to Loop from polluting activeReachable
                  const activeBfs = switchOutEdges.filter(e => (e.sourceHandle === matchedHandle || e.source_handle === matchedHandle)).map(e => e.target || e.target_node_id || '').filter(t => t && bodyNodeIds.has(t))
                  while (activeBfs.length > 0) {
                    const nid = activeBfs.shift()!
                    if (activeReachable.has(nid)) continue
                    activeReachable.add(nid)
                    edges.filter(e => e.source === nid || e.source_node_id === nid).forEach(e => { const t = e.target || e.target_node_id || ''; if (t && bodyNodeIds.has(t)) activeBfs.push(t) })
                  }
                  for (const h of inactiveHandles) {
                    // Filter seeds to bodyNodeIds — prevents back-edges to Loop from marking upstream nodes as inactive
                    const bfs = switchOutEdges.filter(e => (e.sourceHandle === h || e.source_handle === h)).map(e => e.target || e.target_node_id || '').filter(t => t && bodyNodeIds.has(t))
                    while (bfs.length > 0) {
                      const nid = bfs.shift()!
                      if (iterSkipped.has(nid) || activeReachable.has(nid)) continue
                      iterSkipped.add(nid)
                      edges.filter(e => e.source === nid || e.source_node_id === nid).forEach(e => { const t = e.target || e.target_node_id || ''; if (t && !activeReachable.has(t) && bodyNodeIds.has(t)) bfs.push(t) })
                    }
                  }
                  const switchBaseInput = (switchResult.input && typeof switchResult.input === 'object') ? (switchResult.input as Record<string, unknown>) : {}
                  iterLastOutput = { ...switchBaseInput, matched_case: matchedHandle }
                } else {
                  iterLastOutput = iterOutput
                }

                iterVars.input = iterLastOutput
                if (iterLastOutput && typeof iterLastOutput === 'object') {
                  Object.assign(iterVars, flattenOutput(iterLastOutput as Record<string, unknown>))
                }
                nodeLogs.push({
                  node_id: bodyNode.id,
                  node_type: bodyNode.type,
                  node_label: `${bodyNode.label || bodyNode.type} ${iterLabel}`,
                  status: 'success',
                  input: iterInputSnapshot,
                  output: iterOutput,
                  duration_ms: iterDuration,
                })
              } catch (iterErr) {
                const iterDuration = Date.now() - iterStart
                const iterMsg = iterErr instanceof Error ? iterErr.message : String(iterErr)
                if (iterMsg === 'BRANCH_SKIPPED') {
                  nodeLogs.push({ node_id: bodyNode.id, node_type: bodyNode.type, node_label: `${bodyNode.label || bodyNode.type} ${iterLabel}`, status: 'skipped', input: iterInputSnapshot, output: null, duration_ms: iterDuration })
                  continue
                }
                if (iterMsg === 'FLOW_STOPPED') {
                  nodeLogs.push({ node_id: bodyNode.id, node_type: bodyNode.type, node_label: `${bodyNode.label || bodyNode.type} ${iterLabel}`, status: 'skipped', input: iterInputSnapshot, output: null, duration_ms: iterDuration })
                  break
                }
                nodeLogs.push({ node_id: bodyNode.id, node_type: bodyNode.type, node_label: `${bodyNode.label || bodyNode.type} ${iterLabel}`, status: 'error', input: iterInputSnapshot, output: null, error: iterMsg, duration_ms: iterDuration })
                break // stop remaining body nodes for this item, continue with next item
              }
            }
            loopResults.push(iterLastOutput)
            await updateLog('running')
          }

          // After loop, expose summary to "done" branch
          const adsCreated = loopResults
            .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !!(r as Record<string, unknown>).ad_id)
          const loopResultsAds = adsCreated.length > 0
            ? adsCreated.map(r => `• AD ${r.ad_id} — https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${r.ad_id}`).join('\n')
            : 'Nenhum anúncio criado nesta execução.'
          lastOutput = { total: items.length, batches: totalBatches, batch_size: batchSize, completed: items.length, loop_results: loopResults, loop_results_ads: loopResultsAds, ads_criados: adsCreated.length }
          templateVars.input = lastOutput
          templateVars.loop_total = items.length
          Object.assign(templateVars, flattenOutput(lastOutput as Record<string, unknown>))

          // Update Loop node log entry to show iteration count (like n8n)
          let loopLogIdx = -1
          for (let li = nodeLogs.length - 1; li >= 0; li--) { if (nodeLogs[li].node_id === node.id) { loopLogIdx = li; break } }
          if (loopLogIdx >= 0) {
            nodeLogs[loopLogIdx].node_label = `${node.label || 'Loop'} — ${items.length} item${items.length !== 1 ? 'ns' : ''}`
            nodeLogs[loopLogIdx].output = lastOutput
          }
        }
        // ─────────────────────────────────────────────────────────────────────

        await updateLog('running')
      } catch (err) {
        const duration = Date.now() - startTime
        const message = err instanceof Error ? err.message : String(err)

        if (message === 'BRANCH_SKIPPED') {
          nodeLogs.push({
            node_id: node.id,
            node_type: node.type,
            node_label: node.label || node.type,
            status: 'skipped',
            input: inputSnapshot,
            output: null,
            duration_ms: duration,
          })
          await updateLog('running')
          continue
        }

        if (message === 'FLOW_STOPPED') {
          nodeLogs.push({
            node_id: node.id,
            node_type: node.type,
            node_label: node.label || node.type,
            status: 'success',
            input: inputSnapshot,
            output: null,
            duration_ms: duration,
          })
          await supabase.from('automations').update({ last_run_at: new Date().toISOString() }).eq('id', automationId)
          await updateLog('success')
          return executionId
        }

        nodeLogs.push({
          node_id: node.id,
          node_type: node.type,
          node_label: node.label || node.type,
          status: 'error',
          input: inputSnapshot,
          output: null,
          error: message,
          duration_ms: duration,
        })

        await updateLog('error')
        throw err
      }
    }

    // Update automation last run
    await supabase.from('automations').update({ last_run_at: new Date().toISOString() }).eq('id', automationId)
    await updateLog('success')

    return executionId
  } catch (err) {
    await updateLog('error')
    return executionId  // Always return executionId so frontend can check logs
  }
}

function flattenOutput(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    const k = prefix ? `${prefix}.${key}` : key
    result[k] = val
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenOutput(val as Record<string, unknown>, k))
    }
  }
  return result
}

function getWeekRange(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

// Meta API errors that should skip the item (not count as failure)
const SKIPPABLE_META_CODES = [
  '2875030', // Reel with copyrighted music cannot be used as ad
  '1487470', // Content not eligible for promotion
  '1487760', // Post cannot be boosted — copyright/policy violation
  '1885006', // Media cannot be promoted
  '1885057', // Reel is not eligible for ads
  '2207026', // Reel not eligible for ads
  '1349152', // Post cannot be used as ad creative
  '1815279', // Incompatibilidade técnica de vídeo no fluxo da Meta API
  '2061015', // Website URL obrigatório — objetivo da campanha incompatível com boost de post existente
  '2446383', // Objetivo da campanha requer URL de site externo — incompatível com boost de post existente
  '1346001', // Validation error genérico da Meta — post não pode ser turbinado
]

const SKIPPABLE_META_PATTERNS = [
  'not eligible',
  'cannot be used',
  'cannot be promoted',
  'not promotable',
  'media cannot',
  'direitos autorais',
  'copyright',
  'music rights',
]

function isSkippableMetaError(msg: string, mediaType?: string): boolean {
  const lower = msg.toLowerCase()
  if (SKIPPABLE_META_CODES.some((code) => msg.includes(code))) return true
  if (SKIPPABLE_META_PATTERNS.some((p) => lower.includes(p))) return true
  return false
}

function humanizeBoostIneligibility(reason: string): string {
  if (reason.includes('COPYRIGHT') || reason.includes('MUSIC')) return 'Reel com música protegida por direitos autorais — não pode ser anunciado'
  if (reason.includes('COLLAB') || reason.includes('COLLABORATION')) return 'Reel em colaboração (collab) — não pode ser anunciado'
  if (reason.includes('TEMPLATE')) return 'Reel criado a partir de template — não pode ser anunciado'
  if (reason.includes('FILTER') || reason.includes('EFFECT')) return 'Reel com efeito/filtro restrito — não pode ser anunciado'
  if (reason.includes('REMIX')) return 'Reel remixado — não pode ser anunciado'
  if (reason.includes('INTERACTIVE')) return 'Reel com elemento interativo — não pode ser anunciado'
  return `Reel não elegível para anúncio (${reason}) — item pulado`
}

function humanizeMetaSkipReason(msg: string): string {
  const lower = msg.toLowerCase()
  if (msg.includes('2061015')) {
    return 'Campanha de tráfego para site requer URL de destino — configure a "URL de destino" no node "Criar anúncio"'
  }
  if (msg.includes('2446383')) {
    return 'Objetivo da campanha requer URL de site externo — incompatível com boost de post existente'
  }
  if (msg.includes('2875030') || lower.includes('músicas com direitos') || lower.includes('copyright') || lower.includes('music rights')) {
    return 'Reel com música protegida por direitos autorais — não pode ser anunciado'
  }
  if (msg.includes('1487470') || msg.includes('1487760') || msg.includes('1885006') || msg.includes('1885057') || msg.includes('2207026') || msg.includes('1349152')) {
    return 'Post não elegível para promoção pela Meta — item pulado'
  }
  if (msg.includes('1815279')) {
    return 'Vídeo com incompatibilidade técnica no fluxo da Meta API — suba o anúncio manualmente no Gerenciador de Anúncios'
  }
  if (lower.includes('not eligible') || lower.includes('cannot be') || lower.includes('not promotable') || lower.includes('media cannot')) {
    return 'Post com restrição da Meta — item pulado'
  }
  return 'Post bloqueado pela política do Meta — item pulado'
}

async function executeNode(
  node: AutomationNode,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const [category, action] = node.type.split('.')

  switch (category) {
    case 'meta':
      return executeMeta(action, config, input, context)
    case 'ai':
      return executeAI(action, config, input, context)
    case 'whatsapp':
      return executeWhatsapp(action, config, input, context)
    case 'logic':
      return executeLogic(action, config, input, context)
    case 'util':
      return executeUtil(action, config, input, context)
    case 'notion':
      return executeNotion(action, config, input, context)
    case 'drive':
      return executeDrive(action, config, input, context)
    case 'ticktick':
      return executeTickTick(action, config, input, context)
    default:
      return input
  }
}

// ─── META ─────────────────────────────────────────────────────────────────────

function detectImagePlacement(buf: Buffer): { width: number; height: number; placement_type: string } {
  let width = 1, height = 1
  if (buf[0] === 0x89 && buf[1] === 0x50) { // PNG
    width = buf.readUInt32BE(16)
    height = buf.readUInt32BE(20)
  } else if (buf[0] === 0xFF && buf[1] === 0xD8) { // JPEG
    for (let i = 2; i < buf.length - 8; i++) {
      if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC2)) {
        height = buf.readUInt16BE(i + 5)
        width = buf.readUInt16BE(i + 7)
        break
      }
    }
  }
  const placement_type = height / width >= 1.6 ? 'story' : 'feed'
  return { width, height, placement_type }
}

async function executeMeta(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const token = context.client?.meta_token || context.settings.meta_token
  if (!token) throw new Error('Token Meta não configurado')

  const meta = new MetaService(token, context.client?.ad_account_id || '')

  const periodMap: Record<string, string> = {
    '7d': 'last_7d',
    '14d': 'last_14d',
    '30d': 'last_30d',
    'this_month': 'this_month',
    'yesterday': 'yesterday',
    'today': 'today',
    'last_3d': 'last_3d',
    'last_90_days': 'last_90d',
  }

  switch (action) {
    // ── Leitura ──────────────────────────────────────────────────────────
    case 'fetch_campaigns': {
      const campaigns = await meta.getCampaigns(config.status as string | undefined)
      return { campanhas: campaigns, total: campaigns.length }
    }

    case 'fetch_adsets': {
      const adsets = await meta.getAdSets(config.campaign_id as string | undefined)
      return { adsets, total: adsets.length }
    }

    case 'fetch_ads': {
      const parentType = (config.parent_type as 'campaign' | 'adset' | 'account') || 'account'
      const statusFilter = (config.status_filter as string) || 'ACTIVE'
      const ads = await meta.getAds(config.parent_id as string | undefined, parentType, statusFilter)
      return { anuncios: ads, total: ads.length }
    }

    case 'get_ad_metrics': {
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      const period = (config.period as string) ?? '7d'
      const source = (config.source as string) || 'fetch'
      const metricsLevel = (config.metrics_level as string) || 'per_ad'
      const datePreset = periodMap[period] || period

      // ── AGGREGATED MODE: return single metrics object for the whole adset/campaign ──
      if (metricsLevel === 'aggregated') {
        const parentId = (config.parent_id as string) || null
        const metricas = await meta.getMetrics(parentId, datePreset, [])
        return { metricas }
      }

      // ── PER-AD MODE: enrich each individual ad with its own metrics ──
      let baseAds: import('../services/meta.service').MetaAd[]
      if (source === 'input') {
        baseAds = (inputRecord.anuncios as import('../services/meta.service').MetaAd[]) || []
      } else {
        const level = (config.level as 'campaign' | 'adset' | 'account') || 'account'
        const parentId = config.parent_id as string | undefined
        const statusFilter = (config.status_filter as string) || 'ACTIVE'
        baseAds = await meta.getAds(parentId, level, statusFilter)
      }

      const enriched = await Promise.all(baseAds.map(async (ad) => {
        const metricas = await meta.getMetrics(ad.id, datePreset, [])
        const ageDays = ad.created_time
          ? Math.floor((Date.now() - new Date(ad.created_time).getTime()) / 86_400_000)
          : null
        const permalink = `https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${ad.id}`
        return { ...ad, metricas, age_days: ageDays, permalink }
      }))

      const totalAtivos = enriched.length
      const enrichedWithTotal = enriched.map(ad => ({ ...ad, _total_ativos: totalAtivos }))
      return { anuncios: enrichedWithTotal, total: totalAtivos }
    }

    case 'fetch_metrics': {
      const period = (config.period as string) || '7d'
      const datePreset = periodMap[period] || period
      const breakdown = config.breakdown as string

      if (breakdown === 'ad') {
        const adsetId = config.object_id as string
        if (!adsetId) throw new Error('Selecione um conjunto de anúncios para usar o breakdown por anúncio')
        const anuncios = await meta.getMetricsByAd(adsetId, datePreset, [])
        return { anuncios_metricas: anuncios, total: anuncios.length }
      }

      const metrics = await meta.getMetrics(
        (config.object_id as string) || null,
        datePreset,
        [],
        breakdown
      )
      return { metricas: metrics }
    }

    case 'fetch_creative_insights': {
      const insights = await meta.getCreativeInsights(config.ad_id as string | undefined)
      return { insights, total: insights.length }
    }

    case 'evaluate_campaign_performance': {
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}

      // Load client scoring config from DB
      if (!context.client?.id) throw new Error('Cliente não identificado no contexto')
      const clientRow = await getClient(context.client.id)
      const cfg = (clientRow.scoring_config || { rules: [] }) as ScoringConfig

      // Node-level overrides
      const threshold = (config.threshold as number) ?? cfg.threshold ?? 60
      const minDays = cfg.min_days_running ?? 7
      const maxDays = cfg.max_days_running ?? null
      const minActivesMode = cfg.min_actives_mode ?? 'fixed'
      const minActivesFixed = cfg.min_actives_fixed ?? 2
      const budgetPerCreative = cfg.budget_per_creative ?? 25
      const rules = (cfg.rules || []).filter(r => r.enabled !== false)

      type EnrichedAd = import('../services/meta.service').MetaAd & {
        metricas?: import('../services/meta.service').MetaMetrics
        age_days?: number | null
      }

      // Helper: score a single ad's metrics against rules
      const calcScore = (metricas: import('../services/meta.service').MetaMetrics): number => {
        const enabledRules = rules as ScoringRule[]
        const totalWeight = enabledRules.reduce((s, r) => s + r.weight, 0)
        if (totalWeight === 0) return 0
        const metricsMap: Record<string, number> = {
          // resultado
          engajamentos: metricas.engajamentos ?? 0, leads: metricas.leads ?? 0,
          compras: metricas.compras ?? 0, seguidores: metricas.seguidores ?? 0,
          conversas_iniciadas: metricas.conversas_iniciadas ?? 0,
          adicoes_carrinho: metricas.adicoes_carrinho ?? 0,
          visualizacoes_video: metricas.visualizacoes_video ?? 0,
          thruplay: metricas.thruplay ?? 0,
          // custo por resultado
          cpe: metricas.cpe ?? 0, cpl: metricas.cpl ?? 0, custo_mensagem: metricas.custo_mensagem ?? 0,
          custo_compra: metricas.custo_compra ?? 0, custo_seguidor: metricas.custo_seguidor ?? 0,
          custo_conversa: metricas.custo_conversa ?? 0, custo_adicao: metricas.custo_adicao ?? 0,
          custo_thruplay: metricas.custo_thruplay ?? 0,
          // qualidade
          ctr: metricas.ctr ?? 0, cliques_link: metricas.cliques_link ?? 0, hook_rate: metricas.hook_rate ?? 0,
          // saturação
          frequencia: metricas.frequencia ?? 0,
          // distribuição
          cpm: metricas.cpm ?? 0, cpc: metricas.cpc ?? 0,
          alcance: metricas.alcance ?? 0, impressoes: metricas.impressoes ?? 0,
          // controle
          gasto: metricas.gasto ?? 0,
          // retorno
          roas: metricas.roas ?? 0, receita: metricas.receita ?? 0,
        }
        let weightedPassed = 0
        for (const rule of enabledRules) {
          const val = metricsMap[rule.metric]
          if (val !== undefined) {
            const passes = rule.operator === '>=' ? val >= rule.target : val <= rule.target
            if (passes) weightedPassed += rule.weight
          }
        }
        return Math.round((weightedPassed / totalWeight) * 100)
      }

      // ── SINGLE-AD MODE: input is one ad (from Loop {{item}}) ──────────────
      const inputVar = (config.input_var as string) || 'anuncios'
      const isSingleAd = inputRecord.id && !inputRecord[inputVar]
      if (isSingleAd) {
        const ad = inputRecord as unknown as EnrichedAd
        const metricas = ad.metricas || {} as import('../services/meta.service').MetaMetrics
        const ageDays = ad.age_days !== undefined
          ? ad.age_days
          : (ad.created_time ? Math.floor((Date.now() - new Date(ad.created_time).getTime()) / 86_400_000) : null)

        const score = calcScore(metricas)
        const tooYoung = ageDays !== null && ageDays < minDays
        const tooOld = maxDays !== null && ageDays !== null && ageDays > maxDays
        const collapso = score < 10 && ageDays !== null && ageDays > 3
        const skipEvaluation = tooYoung && !collapso

        // Saturation detection: frequencia rule failing = creative fatigue
        const frequenciaRule = (rules as ScoringRule[]).find(r => r.enabled && r.metric === 'frequencia')
        const currentFreq = metricas.frequencia ?? 0
        const isSaturating = !skipEvaluation && (
          frequenciaRule
            ? (frequenciaRule.operator === '<=' && currentFreq > frequenciaRule.target)
            : currentFreq > 3
        )

        let pausar = false
        let motivo = ''
        if (skipEvaluation) {
          motivo = `Aguardando maturação (${ageDays}d < ${minDays}d mínimo)`
        } else if (tooOld) {
          pausar = true
          motivo = `Tempo máximo atingido (${ageDays}d > ${maxDays}d)`
        } else if (score < threshold) {
          pausar = true
          motivo = `Score ${score}/${threshold} — abaixo do threshold`
        } else {
          motivo = `Score ${score}/${threshold} — aprovado`
        }

        const totalAtivos = (ad as unknown as Record<string, unknown>)._total_ativos as number | undefined
        const minActives = (config.min_actives_fixed as number) ?? 3
        // Se pausar este anúncio ficaria abaixo do mínimo, protege
        const ativosAbaixoMinimo = totalAtivos !== undefined && totalAtivos <= minActives

        // Prioridade: pausar sempre vence, EXCETO se cair abaixo do mínimo de ativos
        let acao: string
        if (skipEvaluation) {
          acao = 'manter'
        } else if (pausar && ativosAbaixoMinimo) {
          acao = 'alertar'
          motivo += ` — Mantido: pausar reduziria abaixo do mínimo de ${minActives} ativo(s) no conjunto`
        } else if (pausar) {
          acao = 'pausar'
          if (isSaturating) motivo += ` — Frequência ${currentFreq.toFixed(1)} também indica saturação`
        } else if (isSaturating) {
          acao = 'alertar'
          motivo += ` — Frequência ${currentFreq.toFixed(1)} indica saturação`
        } else {
          acao = 'manter'
        }

        return {
          acao,
          pausar,
          alertar: acao === 'alertar',
          manter: acao === 'manter',
          score,
          motivo,
          motivo_alerta: acao === 'alertar' ? motivo : '',
          age_days: ageDays,
          skip_evaluation: skipEvaluation,
          id: ad.id,
          nome: ad.name,
          permalink: (ad as unknown as Record<string, unknown>).permalink as string || '',
          metricas,
        }
      }

      // ── BULK MODE: input has {[inputVar]:[...]} ───────────────────────────
      const ads = (inputRecord[inputVar] as EnrichedAd[]) || []

      // Evaluate each ad (metrics must be pre-fetched via get_ad_metrics node)
      const evaluated = ads.map((ad) => {
        const metricas = ad.metricas || {} as import('../services/meta.service').MetaMetrics

        // Age in days — use pre-computed or calculate from created_time
        const ageDays = ad.age_days !== undefined
          ? ad.age_days
          : (ad.created_time ? Math.floor((Date.now() - new Date(ad.created_time).getTime()) / 86_400_000) : null)

        const tooYoung = ageDays !== null && ageDays < minDays
        const tooOld = maxDays !== null && ageDays !== null && ageDays > maxDays

        const score = calcScore(metricas)
        const collapso = score < 10 && ageDays !== null && ageDays > 3

        return {
          id: ad.id,
          nome: ad.name,
          adset_id: ad.adset_id,
          score,
          metricas,
          age_days: ageDays,
          skip_evaluation: tooYoung && !collapso,
          force_pause: tooOld,
          abaixo_threshold: score < threshold,
        }
      })

      // Group by adset, apply minimum actives protection per adset
      const adsetGroups = new Map<string, typeof evaluated>()
      for (const e of evaluated) {
        const g = adsetGroups.get(e.adset_id) || []
        g.push(e)
        adsetGroups.set(e.adset_id, g)
      }

      const pausar: Array<typeof evaluated[0] & { motivo: string; protegido?: undefined }> = []
      const manter: Array<typeof evaluated[0] & { motivo?: string; protegido: boolean }> = []
      let alertar = false

      for (const [, group] of adsetGroups) {
        let minActives = minActivesFixed
        if (minActivesMode === 'budget_based') {
          // For budget_based: find adset budget from getAdSets if possible, else fallback
          try {
            const adsets = await meta.getAdSets(undefined)
            const adset = adsets.find(a => a.id === group[0]?.adset_id)
            if (adset?.daily_budget) {
              const budget = parseFloat(adset.daily_budget) / 100 // Meta returns in cents
              minActives = Math.max(1, Math.ceil(budget / budgetPerCreative))
            }
          } catch {
            minActives = minActivesFixed
          }
        }

        // Sort by score desc — best performers protected first
        const sorted = [...group].sort((a, b) => b.score - a.score)
        const protectedSet = new Set(sorted.slice(0, minActives).map(a => a.id))

        for (const ad of group) {
          if (ad.skip_evaluation) {
            manter.push({ ...ad, protegido: false, motivo: `Aguardando maturação (${ad.age_days}d < ${minDays}d mínimo)` })
            continue
          }
          if (ad.force_pause) {
            pausar.push({ ...ad, motivo: `Tempo máximo atingido (${ad.age_days}d > ${maxDays}d)` })
            continue
          }
          if (!ad.abaixo_threshold) {
            manter.push({ ...ad, protegido: false })
            continue
          }
          if (protectedSet.has(ad.id)) {
            manter.push({ ...ad, protegido: true, motivo: `Score ${ad.score}/${threshold} — mantido por mínimo de ativos` })
            alertar = true
          } else {
            pausar.push({ ...ad, motivo: `Score ${ad.score}/${threshold} — abaixo do threshold` })
          }
        }
      }

      const protegidosAbaixo = manter.filter(a => a.protegido).length
      const motivo_alerta = alertar
        ? `${protegidosAbaixo} criativo(s) abaixo da meta estão sendo mantidos pois atingiu o mínimo de ativos — cliente precisa enviar novos criativos`
        : ''

      return {
        pausar,
        manter,
        alertar,
        motivo_alerta,
        resumo: `${evaluated.length} ativo(s) → pausar ${pausar.length}, manter ${manter.length}`,
        total_ativos: evaluated.length,
        total_pausar: pausar.length,
        total_manter: manter.length,
      }
    }

    case 'fetch_instagram_posts': {
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      const instagramId = (config.instagram_account_id as string)
        || (inputRecord.instagram_account_id as string)
        || context.client?.instagram_account_id
      if (!instagramId) throw new Error('ID da conta Instagram não configurado. Configure no bloco ou no cadastro do cliente.')
      const posts = await meta.getInstagramPosts(
        instagramId,
        (config.limit as number) || 20,
        (config.media_type as string) || undefined,
        (config.period as string) || undefined,
        (config.date_from as string) || undefined,
        (config.date_to as string) || undefined,
      )
      return { posts, total: posts.length, instagram_account_id: instagramId }
    }

    case 'fetch_audiences': {
      const audiences = await meta.getAudiences()
      return { publicos: audiences, total: audiences.length }
    }

    // ── Criação ──────────────────────────────────────────────────────────
    case 'create_campaign': {
      const result = await meta.createCampaign({
        name: config.name as string,
        objective: config.objective as string,
        status: (config.status as string) || 'PAUSED',
        daily_budget: config.daily_budget as number | undefined,
        lifetime_budget: config.lifetime_budget as number | undefined,
        start_time: config.start_time as string | undefined,
        stop_time: config.stop_time as string | undefined,
        special_ad_categories: (config.special_ad_categories as string[]) || [],
      })
      return { campanha_criada: result, campaign_id: result.id }
    }

    case 'create_adset': {
      const targeting = config.targeting
        ? (typeof config.targeting === 'string' ? JSON.parse(config.targeting) : config.targeting)
        : { geo_locations: { countries: ['BR'] } }
      const result = await meta.createAdSet({
        campaign_id: config.campaign_id as string,
        name: config.name as string,
        optimization_goal: (config.optimization_goal as string) || 'REACH',
        billing_event: (config.billing_event as string) || 'IMPRESSIONS',
        daily_budget: config.daily_budget as number | undefined,
        lifetime_budget: config.lifetime_budget as number | undefined,
        bid_amount: config.bid_amount as number | undefined,
        targeting,
        status: (config.status as string) || 'PAUSED',
        start_time: config.start_time as string | undefined,
        end_time: config.end_time as string | undefined,
      })
      return { adset_criado: result, adset_id: result.id }
    }

    case 'create_ad': {
      const adsetId = (config.adset_id as string) || ''
      if (!adsetId) throw new Error('Conjunto de anúncios (adset_id) não configurado no bloco. Selecione um conjunto e salve a automação antes de executar.')

      // Se vier source_instagram_media_id, cria criativo a partir de post existente do Instagram
      if (config.source_instagram_media_id) {
        const instagramAccountId = (config.instagram_user_id as string) || (config.instagram_actor_id as string) || context.client?.instagram_account_id || undefined
        const pageId = (config.page_id as string) || context.client?.facebook_page_id || undefined
        const postData = (input && typeof input === 'object' && !Array.isArray(input))
          ? input as Record<string, unknown>
          : {}

        // Verificar elegibilidade antes de tentar criar o anúncio
        const boostInfo = postData.boost_eligibility_info as Record<string, unknown> | undefined
        if (boostInfo && boostInfo.eligible_to_boost === false) {
          const reason = (boostInfo.boost_ineligible_reason as string)
            || (boostInfo.boost_ineligibility_reason as string)
            || 'Motivo não informado pela Meta'
          return {
            success: false,
            ad_id: '',
            motivo: reason,
            erro_meta: reason,
            post_id: config.source_instagram_media_id as string,
            post_permalink: (postData.permalink as string) || '',
            post_caption: (postData.caption as string) || '',
            post_media_type: (postData.media_type as string) || '',
            post_media_url: (postData.media_url as string) || '',
            post_timestamp: (postData.timestamp as string) || '',
          }
        }

        try {
          const result = await meta.createAdFromInstagramPost({
            postId: config.source_instagram_media_id as string,
            instagramAccountId,
            pageId,
            adsetId,
            adName: (config.name as string) || `Post ${config.source_instagram_media_id}`,
            status: (config.status as string) || 'PAUSED',
            destinationUrl: (config.destination_url as string) || undefined,
          })
          return {
            success: true,
            ad_id: result.ad_id,
            creative_id: result.creative_id,
            post_permalink: (postData.permalink as string) || '',
            post_caption: (postData.caption as string) || '',
            post_media_type: (postData.media_type as string) || '',
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          const mediaType = (postData.media_type as string) || ''
          const motivo = isSkippableMetaError(msg, mediaType) ? humanizeMetaSkipReason(msg) : msg
          return {
            success: false,
            ad_id: '',
            motivo,
            erro_meta: msg,
            post_id: config.source_instagram_media_id as string,
            post_permalink: (postData.permalink as string) || '',
            post_caption: (postData.caption as string) || '',
            post_media_type: (postData.media_type as string) || '',
            post_media_url: (postData.media_url as string) || '',
            post_timestamp: (postData.timestamp as string) || '',
          }
        }
      }

      // Pega video_id e image_hash da saída do node anterior (Upload criativo) automaticamente
      const prevOutput = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      const result = await meta.createAd({
        adset_id: config.adset_id as string,
        name: config.name as string,
        creative_id: config.creative_id as string | undefined,
        title: config.title as string | undefined,
        body: config.body as string | undefined,
        image_url: config.image_url as string | undefined,
        // prevOutput wins — se há um nó upload_creative anterior, usa sempre o hash/video_id dele
        // config só é fallback se o usuário digitou um valor real (sem espaços = não é placeholder)
        image_hash: (prevOutput.image_hash as string) || ((config.image_hash as string || '').trim().includes(' ') ? undefined : config.image_hash as string) || undefined,
        video_id: (prevOutput.video_id as string) || ((config.video_id as string || '').trim().includes(' ') ? undefined : config.video_id as string) || undefined,
        thumbnail_hash: (prevOutput.thumbnail_hash as string) || (config.thumbnail_hash as string) || undefined,
        link_url: config.link_url as string | undefined,
        call_to_action: config.call_to_action as string | undefined,
        page_id: (config.page_id as string) || context.client?.facebook_page_id || undefined,
        // Só passa instagram_user_id se explicitamente configurado no bloco (substitui instagram_actor_id desde API v22.0)
        instagram_user_id: (config.instagram_user_id as string) || (config.instagram_actor_id as string) || undefined,
        status: (config.status as string) || 'PAUSED',
      })
      return { anuncio_criado: result, ad_id: result.id }
    }

    case 'boost_post': {
      const targeting = config.targeting
        ? (typeof config.targeting === 'string' ? JSON.parse(config.targeting) : config.targeting)
        : { geo_locations: { countries: ['BR'] }, age_min: 18, age_max: 65 }
      const result = await meta.boostPost({
        post_id: config.post_id as string,
        page_id: config.page_id as string,
        daily_budget: (config.daily_budget as number) || 10,
        duration_days: (config.duration_days as number) || 7,
        targeting,
        optimization_goal: config.optimization_goal as string | undefined,
      })
      return { boost_criado: result, ...result }
    }

    case 'filter_unsponsored_posts': {
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      // source_posts: user can specify {{posts}} from any previous node; after interpolation it becomes a JSON string
      // Falls back to input.posts or input.input.posts (when preceded by logic.if which wraps input)
      let posts: Array<Record<string, unknown>> = []
      const sourcePosts = config.source_posts
      if (Array.isArray(sourcePosts)) {
        posts = sourcePosts as Array<Record<string, unknown>>
      } else if (sourcePosts && typeof sourcePosts === 'string' && sourcePosts.trim()) {
        try { posts = JSON.parse(sourcePosts) } catch { posts = [] }
      } else {
        posts = (inputRecord.posts as Array<Record<string, unknown>>)
          || ((inputRecord.input as Record<string, unknown>)?.posts as Array<Record<string, unknown>>)
          || []
      }
      const instagramAccountId = (config.instagram_account_id as string)
        || (inputRecord.instagram_account_id as string)
        || context.client?.instagram_account_id

      if (!posts.length) return { posts: [], total: 0, posts_pulados: 0, instagram_account_id: instagramAccountId }

      // Filtra apenas posts que já têm anúncio ativo via Meta API
      const metaSponsoredIds = await meta.getSponsoredInstagramPostIds()
      const naoPatrocinados = posts.filter((p) => !metaSponsoredIds.has(p.id as string))

      return {
        posts: naoPatrocinados,
        total: naoPatrocinados.length,
        posts_pulados: posts.length - naoPatrocinados.length,
        instagram_account_id: instagramAccountId,
      }
    }

    case 'filter_eligible_posts': {
      // Funciona em dois modos:
      // 1. Dentro de loop: input é um item individual com boost_eligibility_info
      // 2. Fora de loop: input.posts é um array de posts
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}

      // Detecta modo: item individual tem campo 'id' e 'boost_eligibility_info' diretamente
      const isSingleItem = inputRecord.id && !Array.isArray(inputRecord.posts)
      let posts: Array<Record<string, unknown>> = []
      if (isSingleItem) {
        posts = [inputRecord]
      } else {
        const sourcePosts = config.source_posts
        if (Array.isArray(sourcePosts)) {
          posts = sourcePosts as Array<Record<string, unknown>>
        } else if (sourcePosts && typeof sourcePosts === 'string' && sourcePosts.trim()) {
          try { posts = JSON.parse(sourcePosts) } catch { posts = [] }
        } else {
          posts = (inputRecord.posts as Array<Record<string, unknown>>)
            || ((inputRecord.input as Record<string, unknown>)?.posts as Array<Record<string, unknown>>)
            || []
        }
      }

      const instagramAccountId = (inputRecord.instagram_account_id as string)
        || context.client?.instagram_account_id

      if (!posts.length) return { posts: [], total: 0, posts_inelegiveis: [], total_inelegiveis: 0, instagram_account_id: instagramAccountId }

      const elegíveis: Array<Record<string, unknown>> = []
      const inelegiveis: Array<{ id: string; permalink: string; caption: string; media_type: string; motivo: string; erro_meta: string }> = []
      for (const p of posts) {
        const boostInfo = p.boost_eligibility_info as Record<string, unknown> | undefined
        if (boostInfo && boostInfo.eligible_to_boost === false) {
          // Campo correto da Meta: boost_ineligible_reason (texto legível, já em PT/EN)
          const motivo = (boostInfo.boost_ineligible_reason as string)
            || (boostInfo.boost_ineligibility_reason as string)
            || (boostInfo.ineligibility_reason as string)
            || 'Motivo não informado pela Meta'
          console.log(`[filter_eligible_posts] post ${p.id as string} inelegível:`, motivo)
          inelegiveis.push({
            id: p.id as string,
            permalink: (p.permalink as string) || '',
            caption: (p.caption as string) || '',
            media_type: (p.media_type as string) || '',
            motivo,
            erro_meta: motivo,
          })
        } else {
          elegíveis.push(p)
        }
      }

      if (inelegiveis.length) {
        console.log(`[filter_eligible_posts] ${inelegiveis.length} post(s) inelegível(is):`, JSON.stringify(inelegiveis))
      }

      // Expõe campos do primeiro inelegível diretamente (útil quando item individual)
      const primeiroInelegivel = inelegiveis[0]
      const resumo_inelegiveis = inelegiveis.map((p, i) =>
        `*${i + 1}. ${p.media_type}*\n🔗 ${p.permalink}\n📝 ${p.caption ? p.caption.slice(0, 80) + (p.caption.length > 80 ? '...' : '') : '(sem legenda)'}\n❌ ${p.motivo}\n🛠️ ${p.erro_meta}`
      ).join('\n\n')

      // Quando em modo item individual, expõe os campos do post elegível no top-level
      // para que create_ad encontre permalink, caption, media_type, boost_eligibility_info, etc.
      const primeiroElegivel = elegíveis[0]
      const elegívelSpread = (isSingleItem && primeiroElegivel) ? primeiroElegivel : {}

      return {
        ...elegívelSpread,
        posts: elegíveis,
        total: elegíveis.length,
        posts_inelegiveis: inelegiveis,
        total_inelegiveis: inelegiveis.length,
        resumo_inelegiveis,
        // Campos diretos do post inelegível (modo item individual dentro de loop)
        inelegivel_id: primeiroInelegivel?.id || '',
        inelegivel_permalink: primeiroInelegivel?.permalink || '',
        inelegivel_caption: primeiroInelegivel?.caption || '',
        inelegivel_media_type: primeiroInelegivel?.media_type || '',
        inelegivel_motivo: primeiroInelegivel?.motivo || '',
        inelegivel_erro_meta: primeiroInelegivel?.erro_meta || '',
        instagram_account_id: instagramAccountId,
      }
    }

    case 'create_ads_from_new_posts': {
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      const posts = (inputRecord.posts as Array<{ id: string; timestamp: string; media_type: string }>) || []
      const instagramAccountId = (config.instagram_account_id as string)
        || (inputRecord.instagram_account_id as string)
        || context.client?.instagram_account_id
      const pageId = (config.page_id as string) || context.client?.facebook_page_id || undefined
      const clientId = context.client?.id

      if (!posts.length) return { ads_criados: 0, posts_pulados: 0, detalhes: [] }
      if (!instagramAccountId) throw new Error('ID da conta Instagram não encontrado. Configure no cadastro do cliente.')
      if (!pageId) throw new Error('Página do Facebook não configurada. Configure no cadastro do cliente.')
      if (!clientId) throw new Error('Cliente não identificado no contexto da automação.')

      // 1. Posts já registrados na nossa tabela (criados pelo AdMind)
      const { data: alreadySponsored } = await supabase
        .from('sponsored_posts')
        .select('post_id')
        .eq('client_id', clientId)
      const sponsoredIds = new Set((alreadySponsored || []).map((r: { post_id: string }) => r.post_id))

      // 2. Verificar via Meta API uma única vez
      const metaSponsoredIds2 = await meta.getSponsoredInstagramPostIds()
      const toUpsert2: Array<{ client_id: string; instagram_account_id: string; post_id: string }> = []
      for (const post of posts) {
        if (!sponsoredIds.has(post.id) && metaSponsoredIds2.has(post.id)) {
          sponsoredIds.add(post.id)
          toUpsert2.push({ client_id: clientId as string, instagram_account_id: instagramAccountId as string, post_id: post.id })
        }
      }
      if (toUpsert2.length) {
        await supabase.from('sponsored_posts').upsert(toUpsert2, { onConflict: 'client_id,post_id', ignoreDuplicates: true })
      }

      // Filtrar apenas posts novos (não patrocinados em nenhuma fonte)
      const newPosts = posts.filter((p) => !sponsoredIds.has(p.id))

      if (!newPosts.length) return { ads_criados: 0, posts_pulados: posts.length, detalhes: [] }

      const adsetId = config.adset_id as string
      if (!adsetId) throw new Error('ID do conjunto de anúncios (adset_id) não configurado no bloco.')

      const status = (config.status as string) || 'ACTIVE'
      const detalhes: Array<{ post_id: string; ad_id?: string; status: string; error?: string }> = []

      for (const post of newPosts) {
        try {
          const adName = `Post ${post.id} - ${new Date(post.timestamp).toLocaleDateString('pt-BR')}`
          const result = await meta.createAdFromInstagramPost({
            postId: post.id,
            instagramAccountId,
            pageId,
            adsetId,
            adName,
            status,
          })
          await supabase.from('sponsored_posts').insert({
            client_id: clientId,
            instagram_account_id: instagramAccountId,
            post_id: post.id,
            ad_id: result.ad_id,
            adset_id: adsetId,
          })
          detalhes.push({ post_id: post.id, ad_id: result.ad_id, status: 'criado' })
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          detalhes.push({ post_id: post.id, status: 'erro', error: errMsg })
        }
      }

      const ads_criados = detalhes.filter((d) => d.status === 'criado').length
      return {
        ads_criados,
        posts_pulados: posts.length - newPosts.length,
        patrocinados_externamente: toUpsert2.length,
        detalhes,
      }
    }

    case 'duplicate_campaign': {
      const result = await meta.duplicateCampaign(
        config.campaign_id as string,
        config.new_name as string | undefined
      )
      return { campanha_duplicada: result, campaign_id: result.id }
    }

    case 'create_audience': {
      const result = await meta.createCustomAudience({
        name: config.name as string,
        description: config.description as string | undefined,
        subtype: (config.subtype as 'CUSTOM' | 'WEBSITE' | 'APP' | 'LOOKALIKE') || 'WEBSITE',
        pixel_id: config.pixel_id as string | undefined,
        rule: config.rule as Record<string, unknown> | undefined,
        lookalike_spec: config.lookalike_spec as Record<string, unknown> | undefined,
      })
      return { publico_criado: result, audience_id: result.id }
    }

    // ── Edição ───────────────────────────────────────────────────────────
    case 'edit_campaign': {
      await meta.editCampaign(config.campaign_id as string, {
        name: config.name as string | undefined,
        status: config.status as string | undefined,
        daily_budget: config.daily_budget as number | undefined,
        lifetime_budget: config.lifetime_budget as number | undefined,
        stop_time: config.stop_time as string | undefined,
      })
      return { editado: true, campaign_id: config.campaign_id }
    }

    case 'edit_adset': {
      await meta.editAdSet(config.adset_id as string, {
        name: config.name as string | undefined,
        status: config.status as string | undefined,
        daily_budget: config.daily_budget as number | undefined,
        targeting: config.targeting as Record<string, unknown> | undefined,
        end_time: config.end_time as string | undefined,
      })
      return { editado: true, adset_id: config.adset_id }
    }

    case 'edit_ad': {
      await meta.editAd(config.ad_id as string, {
        name: config.name as string | undefined,
        status: config.status as string | undefined,
        creative_id: config.creative_id as string | undefined,
      })
      return { editado: true, ad_id: config.ad_id }
    }

    case 'adjust_budget': {
      const objectId = (config.campaign_id || config.adset_id || config.object_id) as string
      if (!objectId) throw new Error('ID do objeto não configurado')
      await meta.updateBudget(objectId, {
        daily_budget: config.daily_budget as number | undefined,
        lifetime_budget: config.lifetime_budget as number | undefined,
      })
      return { budget_atualizado: true, object_id: objectId }
    }

    // ── Status ───────────────────────────────────────────────────────────
    case 'pause_ad': {
      const id = (config.ad_id || config.adset_id || config.campaign_id || config.object_id) as string
      if (!id) throw new Error('ID do objeto não configurado')
      await meta.pauseObject(id)
      return { pausado: true, object_id: id }
    }

    case 'activate_ad': {
      const id = (config.ad_id || config.adset_id || config.campaign_id || config.object_id) as string
      if (!id) throw new Error('ID do objeto não configurado')
      await meta.activateObject(id)
      return { ativado: true, object_id: id }
    }

    case 'delete_object': {
      const id = (config.object_id || config.ad_id || config.adset_id || config.campaign_id) as string
      if (!id) throw new Error('ID do objeto não configurado')
      await meta.deleteObject(id)
      return { excluido: true, object_id: id }
    }

    case 'boost_post': {
      const instagramAccountId = (config.instagram_account_id as string)
        || context.client?.instagram_account_id
        || ''
      if (!instagramAccountId) throw new Error('Perfil do Instagram não configurado para este cliente')
      return { instagram_account_id: instagramAccountId, boosted: true }
    }

    // ── Upload criativo do Google Drive para a Meta ───────────────────────
    case 'upload_creative': {
      const driveToken = (context.settings.drive_token as string) || null

      const rawUrl = (config.drive_url as string) || ''
      if (!rawUrl) throw new Error('URL do Google Drive não configurada no bloco')

      // Extrai file ID — suporta: /file/d/{ID}, /open?id={ID}, ?id={ID}
      const fileIdMatch =
        rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/)
      const fileId = fileIdMatch?.[1] || null
      if (!fileId) throw new Error(`URL do Google Drive inválida. URL recebida: "${rawUrl}". Use o link de compartilhamento (drive.google.com/file/d/...)`)

      let fileName = 'creative'
      let mimeType = 'image/jpeg'
      let fileBuffer: Buffer

      if (driveToken) {
        // Com token OAuth: usa API do Drive (suporta arquivos privados)
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
          { headers: { Authorization: `Bearer ${driveToken}` } }
        )
        if (metaRes.ok) {
          const fileMeta = await metaRes.json() as { name?: string; mimeType?: string }
          if (fileMeta.name) fileName = fileMeta.name
          if (fileMeta.mimeType) mimeType = fileMeta.mimeType
        }
        const fileRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${driveToken}` } }
        )
        if (!fileRes.ok) throw new Error(`Erro ao baixar arquivo do Drive (token): ${fileRes.status} ${fileRes.statusText}`)
        fileBuffer = Buffer.from(await fileRes.arrayBuffer())
      } else {
        // Sem token: download direto (arquivo deve estar público — "qualquer pessoa com o link")
        // Tenta múltiplas URLs pois o Google mudou o endpoint de download público
        const driveUrls = [
          `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
          `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
          `https://drive.google.com/uc?export=download&id=${fileId}`,
        ]
        let fileRes: Response | null = null
        let lastError = ''
        for (const url of driveUrls) {
          try {
            const r = await fetch(url, {
              redirect: 'follow',
              signal: AbortSignal.timeout(60_000),
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdMind/1.0)' },
            })
            if (r.ok) { fileRes = r; break }
            lastError = `HTTP ${r.status} em ${url}`
          } catch (e) {
            lastError = `fetch failed em ${url}: ${e instanceof Error ? e.message : e}`
          }
        }
        if (!fileRes) throw new Error(`Erro ao baixar arquivo do Google Drive. ${lastError}. Verifique se o arquivo está compartilhado como "qualquer pessoa com o link".`)
        const ct = fileRes.headers.get('content-type')
        if (ct) mimeType = ct.split(';')[0].trim()
        const cd = fileRes.headers.get('content-disposition')
        if (cd) {
          const fnMatch = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i)
          if (fnMatch) fileName = decodeURIComponent(fnMatch[1].trim())
        }
        fileBuffer = Buffer.from(await fileRes.arrayBuffer())
      }

      const isVideo = mimeType.startsWith('video/')

      if (isVideo) {
        const lowerName = fileName.toLowerCase()
        const placement_type = /story|stories|reel/.test(lowerName) ? 'story' : 'feed'
        const result = await meta.uploadAdVideo(fileBuffer, fileName, mimeType)
        return {
          image_hash: result.thumbnail_hash, video_id: result.video_id,
          type: 'video', placement_type, nome_arquivo: fileName,
        }
      } else {
        const { width, height, placement_type } = detectImagePlacement(fileBuffer)
        const result = await meta.uploadAdImage(fileBuffer)
        return {
          image_hash: result.hash, video_id: null, type: 'image',
          placement_type, width, height, nome_arquivo: fileName,
        }
      }
    }

    default:
      return input
  }
}

// ─── AI ───────────────────────────────────────────────────────────────────────

async function executeAI(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const model = (config.model as string) || 'gpt-4o'
  const isAnthropic = model.startsWith('claude')

  const request = {
    model,
    systemPrompt: (config.system_prompt as string) || '',
    humanMessage: (config.human_message as string) || '',
    temperature: (config.temperature as number) ?? 0.7,
    maxTokens: (config.max_tokens as number) ?? 1000,
    outputFormat: (config.output_format as 'text' | 'json') || 'text',
    outputSchema: config.output_schema as Record<string, unknown>,
  }

  let result
  if (isAnthropic) {
    if (!context.settings.anthropic_key) throw new Error('Anthropic API key não configurada')
    const svc = new AnthropicService(context.settings.anthropic_key)
    result = await svc.complete(request)
  } else {
    if (!context.settings.openai_key) throw new Error('OpenAI API key não configurada')
    const svc = new OpenAIService(context.settings.openai_key)
    result = await svc.complete(request)
  }

  // Save to memory if enabled
  if (config.memory_enabled) {
    await supabase.from('agent_memory').insert([
      { agent_id: config.agent_id, client_id: context.client?.id, execution_id: context.executionId, role: 'user', content: request.humanMessage },
      { agent_id: config.agent_id, client_id: context.client?.id, execution_id: context.executionId, role: 'assistant', content: result.content },
    ])
  }

  return result.parsed || result.content
}

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────

async function executeWhatsapp(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  if (!context.settings.whatsapp_url || !context.settings.whatsapp_token) {
    throw new Error('WhatsApp API não configurada')
  }

  const wa = new WhatsAppService(
    context.settings.whatsapp_url!,
    context.settings.whatsapp_token!,
    context.settings.whatsapp_instance || 'default'
  )
  const number = config.number_type === 'client'
    ? `55${context.client?.whatsapp?.replace(/\D/g, '') ?? ''}`
    : (config.number as string)

  switch (action) {
    case 'send_message':
    case 'send_report': {
      await wa.sendMessage(number, config.message as string)
      return { sent: true, to: number }
    }
    case 'send_file': {
      await wa.sendFile(number, config.file_url as string)
      return { sent: true, to: number }
    }
    default:
      return input
  }
}

// ─── LOGIC ────────────────────────────────────────────────────────────────────

async function executeLogic(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  _context: ExecutionContext
): Promise<unknown> {
  switch (action) {
    case 'wait': {
      const ms =
        (config.duration as number) *
        (config.unit === 'minutes' ? 60000 : config.unit === 'hours' ? 3600000 : 1000)
      await new Promise((r) => setTimeout(r, Math.min(ms, 30000))) // max 30s in execution
      return input
    }

    case 'switch': {
      const { variable, cases } = config as { variable: string; cases?: Array<{ id: string; label: string; value: string }> }
      // Se variable é uma chave simples (ex: "acao"), busca o valor no input record.
      // Se já veio interpolado (ex: "pausar"), usa diretamente — igual ao IF node.
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      const rawVar = String(variable ?? '')
      const actual = (rawVar && Object.prototype.hasOwnProperty.call(inputRecord, rawVar))
        ? String(inputRecord[rawVar])
        : rawVar
      for (const c of (cases || [])) {
        if (c.value && actual.toLowerCase().includes(c.value.toLowerCase())) {
          return { matched_case: c.id, input }
        }
      }
      return { matched_case: 'default', input }
    }

    case 'if': {
      const { variable, operator, value } = config as Record<string, string>
      const inputRecord = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
      const rawVar = variable !== undefined ? String(variable) : ''
      // If variable is a plain key name (no {{}} in original, interpolation left it unchanged),
      // look it up in the input object. If it was already interpolated (e.g. "11"), use as-is.
      const actual = (rawVar && Object.prototype.hasOwnProperty.call(inputRecord, rawVar))
        ? String(inputRecord[rawVar])
        : rawVar !== '' ? rawVar : String(input)
      // Normalize: trim whitespace; convert boolean-like values to lowercase
      const normStr = (s: string) => { const t = s.trim().toLowerCase(); return (t === 'true' || t === 'false') ? t : s.trim() }
      const normalActual = normStr(actual)
      const normalValue = normStr(String(value ?? ''))
      let result = false
      switch (operator) {
        case '>': result = parseFloat(actual) > parseFloat(String(value)); break
        case '<': result = parseFloat(actual) < parseFloat(String(value)); break
        case '>=': result = parseFloat(actual) >= parseFloat(String(value)); break
        case '<=': result = parseFloat(actual) <= parseFloat(String(value)); break
        case '=': result = normalActual === normalValue; break
        case '!=': result = normalActual !== normalValue; break
        case 'contains': result = actual.toLowerCase().includes(String(value ?? '').toLowerCase()); break
        case 'not_contains': result = !actual.toLowerCase().includes(String(value ?? '').toLowerCase()); break
        case 'is_empty': result = !actual || actual === 'null' || actual === 'undefined'; break
        case 'not_empty': result = !!actual && actual !== 'null' && actual !== 'undefined'; break
      }
      return { condition: result, input }
    }

    case 'loop': {
      const listConfig = config.list
      let list: unknown[] = []
      if (Array.isArray(listConfig)) {
        // Already resolved to array by interpolateConfig (pure {{var}} template)
        list = listConfig
      } else if (Array.isArray(input)) {
        list = input
      } else if (listConfig && typeof listConfig === 'string') {
        const listPath = listConfig
        try {
          const parsed = JSON.parse(listPath)
          if (Array.isArray(parsed)) { list = parsed }
        } catch {
          if (input && typeof input === 'object') {
            const keys = listPath.replace(/\{\{|\}\}/g, '').trim().split('.')
            let val: unknown = input
            for (const k of keys) val = (val as Record<string, unknown>)?.[k]
            if (Array.isArray(val)) list = val
          }
        }
      } else if (input && typeof input === 'object' && !Array.isArray(input)) {
        // Auto-detect: find the first array in input or one level deep (handles IF node output)
        const obj = input as Record<string, unknown>
        const topArrays = Object.values(obj).filter(Array.isArray)
        if (topArrays.length === 1) {
          list = topArrays[0] as unknown[]
        } else {
          for (const v of Object.values(obj)) {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              const nested = Object.values(v as Record<string, unknown>).filter(Array.isArray)
              if (nested.length >= 1) { list = nested[0] as unknown[]; break }
            }
          }
        }
      }
      const maxIter = (config.max_iterations as number) || 100
      return { items: list.slice(0, maxIter), total: list.length, item_var: config.item_var || 'item' }
    }

    case 'merge': {
      // Merge two inputs - input is the latest, but both paths arrive here
      if (input && typeof input === 'object' && !Array.isArray(input)) {
        const a = (config.data_a as Record<string, unknown>) || {}
        const b = (config.data_b as Record<string, unknown>) || {}
        return { ...a, ...b, ...(input as Record<string, unknown>) }
      }
      return input
    }

    case 'filter': {
      if (!Array.isArray(input)) return input
      const { field, operator, value } = config as Record<string, string>
      if (!field || !operator) return input
      return input.filter((item) => {
        const itemVal = String((item as Record<string, unknown>)?.[field] ?? '')
        switch (operator) {
          case '>': return parseFloat(itemVal) > parseFloat(value)
          case '<': return parseFloat(itemVal) < parseFloat(value)
          case '>=': return parseFloat(itemVal) >= parseFloat(value)
          case '<=': return parseFloat(itemVal) <= parseFloat(value)
          case '=': return itemVal === value
          case '!=': return itemVal !== value
          case 'contains': return itemVal.toLowerCase().includes(value.toLowerCase())
          case 'not_contains': return !itemVal.toLowerCase().includes(value.toLowerCase())
          case 'is_empty': return !itemVal
          case 'not_empty': return !!itemVal
          default: return true
        }
      })
    }

    case 'transform': {
      const template = config.template as string
      if (!template) return input
      // Try JSON parse first (for object templates), then return as string
      try { return JSON.parse(template) } catch { return template }
    }

    case 'stop': {
      // If preceded by a logic.if, only stop when the condition was false.
      // When condition is true we're on the inactive branch — pass through silently.
      const conditionValue = (input as Record<string, unknown>)?.condition
      if (typeof conditionValue === 'boolean' && conditionValue === true) {
        throw new Error('BRANCH_SKIPPED') // inactive branch — mark as skipped, not success
      }
      throw new Error('FLOW_STOPPED')
    }

    default:
      return input
  }
}

// ─── UTIL ─────────────────────────────────────────────────────────────────────

async function executeUtil(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  _context: ExecutionContext
): Promise<unknown> {
  switch (action) {
    case 'http': {
      const { method, url, headers: headerList, body, auth, auth_token } = config as Record<string, unknown>
      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' }

      if (Array.isArray(headerList)) {
        for (const h of headerList as { key: string; value: string }[]) {
          if (h.key) reqHeaders[h.key] = h.value
        }
      }

      if (auth === 'bearer' && auth_token) {
        reqHeaders['Authorization'] = `Bearer ${auth_token}`
      }

      const res = await fetch(url as string, {
        method: (method as string) || 'GET',
        headers: reqHeaders,
        body: method !== 'GET' && body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      })

      const text = await res.text()
      try { return JSON.parse(text) } catch { return text }
    }

    case 'format_text': {
      return { [config.output_var as string || 'texto']: config.template || '' }
    }

    case 'log': {
      console.log('[AdMind Log]', config.label ? `[${config.label}]` : '', input)
      return input
    }

    case 'set_variable': {
      const varName = config.variable as string
      const varValue = config.value
      if (!varName) return input
      return { ...(input && typeof input === 'object' ? input as Record<string, unknown> : {}), [varName]: varValue }
    }

    default:
      return input
  }
}

// ─── NOTION ───────────────────────────────────────────────────────────────────

async function executeNotion(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const token = context.settings.notion_token
  if (!token) throw new Error('Token Notion não configurado. Configure em Configurações.')

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  }

  switch (action) {
    case 'create_page': {
      const properties = config.properties
        ? (typeof config.properties === 'string' ? JSON.parse(config.properties) : config.properties)
        : {}
      const children = config.content
        ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: config.content as string } }] } }]
        : []
      const body: Record<string, unknown> = {
        parent: { database_id: config.database_id },
        properties,
      }
      if (children.length) body.children = children
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error((data.message as string) || 'Erro ao criar página Notion')
      return { page_id: data.id, url: data.url, criado: true }
    }

    case 'search_pages': {
      const filter = config.filter
        ? (typeof config.filter === 'string' ? JSON.parse(config.filter) : config.filter)
        : undefined
      const sorts = config.sorts
        ? (typeof config.sorts === 'string' ? JSON.parse(config.sorts) : config.sorts)
        : undefined
      const body: Record<string, unknown> = { page_size: (config.limit as number) || 10 }
      if (filter) body.filter = filter
      if (sorts) body.sorts = sorts
      const res = await fetch(`https://api.notion.com/v1/databases/${config.database_id}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json() as { results?: unknown[] }
      if (!res.ok) throw new Error('Erro ao buscar páginas Notion')
      return { paginas: data.results || [], total: (data.results || []).length }
    }

    case 'update_page': {
      const properties = config.properties
        ? (typeof config.properties === 'string' ? JSON.parse(config.properties) : config.properties)
        : {}
      const res = await fetch(`https://api.notion.com/v1/pages/${config.page_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ properties }),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error('Erro ao atualizar página Notion')
      return { page_id: data.id, atualizado: true }
    }

    case 'read_database': {
      const res = await fetch(`https://api.notion.com/v1/databases/${config.database_id}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ page_size: (config.limit as number) || 100 }),
      })
      const data = await res.json() as { results?: unknown[] }
      if (!res.ok) throw new Error('Erro ao ler database Notion')
      return { registros: data.results || [], total: (data.results || []).length }
    }

    default:
      return input
  }
}

// ─── DRIVE ────────────────────────────────────────────────────────────────────

async function executeDrive(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const token = context.settings.drive_token
  if (!token) throw new Error('Token Google Drive não configurado. Configure em Configurações.')

  const authHeader = { 'Authorization': `Bearer ${token}` }

  switch (action) {
    case 'list_files': {
      const folderId = config.folder_id as string
      const query = folderId
        ? `'${folderId}' in parents and trashed = false`
        : 'trashed = false'
      const params = new URLSearchParams({
        q: query,
        fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
        pageSize: String((config.limit as number) || 50),
      })
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: authHeader })
      const data = await res.json() as { files?: unknown[] }
      if (!res.ok) throw new Error('Erro ao listar arquivos do Drive')
      return { arquivos: data.files || [], total: (data.files || []).length }
    }

    case 'download_file': {
      const fileId = config.file_id as string
      // Get file metadata
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
        { headers: authHeader }
      )
      const meta = await metaRes.json() as Record<string, unknown>
      // Get download URL
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
      return { file_id: fileId, name: meta.name, mimeType: meta.mimeType, download_url: downloadUrl }
    }

    case 'upload_file': {
      const metadata = {
        name: config.file_name as string || 'arquivo',
        parents: config.folder_id ? [config.folder_id] : [],
      }
      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            ...authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...metadata, description: config.description }),
        }
      )
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error('Erro ao fazer upload para o Drive')
      return { file_id: data.id, name: data.name, enviado: true }
    }

    case 'create_folder': {
      const body = {
        name: config.folder_name as string || 'Nova pasta',
        mimeType: 'application/vnd.google-apps.folder',
        parents: config.parent_id ? [config.parent_id] : [],
      }
      const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error('Erro ao criar pasta no Drive')
      return { folder_id: data.id, name: data.name, criado: true }
    }

    default:
      return input
  }
}

// ─── TICKTICK ─────────────────────────────────────────────────────────────────

async function executeTickTick(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const { data: settings } = await supabase.from('settings').select('ticktick_token').single()
  const token = settings?.ticktick_token
  if (!token) throw new Error('Token TickTick não configurado nas configurações')

  const vars = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>

  switch (action) {
    case 'create_task': {
      const title = interpolate(config.title as string || 'Tarefa', vars)
      const content = interpolate(config.content as string || '', vars)
      const dueDate = config.due_date ? interpolate(config.due_date as string, vars) : undefined
      const projectId = config.project_id ? interpolate(config.project_id as string, vars) : undefined
      const priority = (config.priority as number) ?? 0

      const body: Record<string, unknown> = { title, content, priority }
      if (dueDate) body.dueDate = `${dueDate}T00:00:00.000+0000`
      if (projectId) body.projectId = projectId

      const res = await fetch('https://api.ticktick.com/open/v1/task', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Erro ao criar tarefa no TickTick: ${err}`)
      }
      const data = await res.json() as Record<string, unknown>
      const taskId = data.id as string
      const taskUrl = `https://ticktick.com/webapp/#p/inbox/tasks/${taskId}`
      return { ...vars, task_id: taskId, task_url: taskUrl }
    }

    default:
      return input
  }
}

// ─── SINGLE NODE EXECUTION (for testing) ─────────────────────────────────────

export type SingleNodeResult = {
  output: unknown
  error?: string
  duration_ms: number
  nodeOutputs: Record<string, { output: unknown; error?: string; duration_ms: number; input: unknown }>
}

export async function executeSingleNode(
  automationId: string,
  nodeId: string,
  _inputData: unknown  // kept for API compatibility; actual input comes from running predecessors
): Promise<SingleNodeResult> {
  const { data: automation } = await supabase
    .from('automations')
    .select('*, automation_nodes(*), automation_edges(*)')
    .eq('id', automationId)
    .single()

  if (!automation) throw new Error('Automação não encontrada')

  const nodes = (automation.automation_nodes || []) as AutomationNode[]
  const edges = (automation.automation_edges || []) as AutomationEdge[]
  const targetNode = nodes.find((n) => n.id === nodeId)
  if (!targetNode) throw new Error('Node não encontrado')

  const { data: client } = automation.client_id
    ? await supabase.from('clients').select('*').eq('id', automation.client_id).single()
    : { data: null }
  const campaigns = automation.client_id ? await getCampaigns(automation.client_id) : []
  const settings = await getSettings()

  const context: ExecutionContext = {
    client: client as Client,
    campaigns,
    settings: settings || ({} as Settings),
    executionId: 'preview',
    triggerPayload: _inputData,
  }

  const baseTemplateVars: Record<string, unknown> = {
    hoje: new Date().toLocaleDateString('pt-BR'),
    amanha: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('pt-BR') })(),
    'amanhã': (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('pt-BR') })(),
    amanha_iso: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })(),
    semana_atual: `semana de ${getWeekRange()}`,
    mes_atual: new Date().toLocaleDateString('pt-BR', { month: 'long' }),
    data_formatada: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
    cliente: client ? {
      nome: (client as Client).name,
      tipo_negocio: (client as Client).business_type,
      contexto: (client as Client).context,
      whatsapp: (client as Client).whatsapp,
      instagram_account_id: (client as Client).instagram_account_id || '',
    } : {},
    campanhas: { todas: campaigns },
    input: _inputData,
  }

  // Build topological order from trigger → targetNode, running all predecessors
  const triggerNode = nodes.find((n) => n.type.startsWith('trigger.'))
  const nodesToRun = triggerNode
    ? buildTopologicalOrder(nodes, edges, triggerNode.id)
    : [targetNode]

  const targetIdx = nodesToRun.findIndex((n) => n.id === nodeId)
  const chain = targetIdx >= 0 ? nodesToRun.slice(0, targetIdx + 1) : [targetNode]

  const nodeOutputs: Record<string, { output: unknown; error?: string; duration_ms: number; input: unknown }> = {}
  let lastOutput: unknown = _inputData

  for (const currentNode of chain) {
    // Skip disabled nodes
    if (currentNode.config?._disabled === true) {
      nodeOutputs[currentNode.id] = { output: lastOutput, duration_ms: 0, input: lastOutput }
      continue
    }

    if (currentNode.type.startsWith('trigger.')) {
      nodeOutputs[currentNode.id] = { output: _inputData, duration_ms: 0, input: null }
      lastOutput = _inputData
      continue
    }

    // If the previous node was a Loop, inject the first item into templateVars
    // so {{item.id}} and similar variables work when testing loop-body nodes.
    let loopItemVars: Record<string, unknown> = {}
    const chainIdx = chain.indexOf(currentNode)
    if (chainIdx > 0) {
      const prevNode = chain[chainIdx - 1]
      if (prevNode.type === 'logic.loop') {
        const loopOutput = nodeOutputs[prevNode.id]?.output as { items?: unknown[]; item_var?: string } | undefined
        const items = loopOutput?.items || []
        const itemVar = loopOutput?.item_var || 'item'
        if (items.length > 0) {
          loopItemVars = { [itemVar]: items[0], loop_index: 0 }
        }
      }
    }

    const templateVars = { ...baseTemplateVars, ...loopItemVars, input: lastOutput }
    const interpolatedConfig = interpolateConfig(currentNode.config, templateVars)
    const startTime = Date.now()
    try {
      const output = await executeNode(currentNode, interpolatedConfig, lastOutput, context)
      const duration = Date.now() - startTime
      nodeOutputs[currentNode.id] = { output, duration_ms: duration, input: lastOutput }

      // Mirror executeAutomation: spread IF output so downstream nodes get flat data + condition flag
      if (currentNode.type === 'logic.if') {
        const ifResult = output as { condition: boolean; input: unknown }
        const ifBaseInput = (ifResult.input && typeof ifResult.input === 'object')
          ? (ifResult.input as Record<string, unknown>) : {}
        lastOutput = { ...ifBaseInput, condition: ifResult.condition }
      } else {
        lastOutput = output
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const duration = Date.now() - startTime

      // BRANCH_SKIPPED: stop node on inactive branch — treat as skipped, continue chain
      if (message === 'BRANCH_SKIPPED') {
        nodeOutputs[currentNode.id] = { output: null, duration_ms: duration, input: lastOutput }
        continue
      }

      // FLOW_STOPPED: stop node triggered — halt chain here (success, not error)
      if (message === 'FLOW_STOPPED') {
        nodeOutputs[currentNode.id] = { output: null, duration_ms: duration, input: lastOutput }
        break
      }

      nodeOutputs[currentNode.id] = { output: null, error: message, duration_ms: duration, input: lastOutput }
      if (currentNode.id === nodeId) {
        return { output: null, error: message, duration_ms: duration, nodeOutputs }
      }
      // Predecessor failed — report error on that predecessor
      return { output: null, error: `Erro no node "${currentNode.label || currentNode.type}": ${message}`, duration_ms: 0, nodeOutputs }
    }
  }

  const targetResult = nodeOutputs[nodeId]
  return {
    output: targetResult?.output ?? null,
    error: targetResult?.error,
    duration_ms: targetResult?.duration_ms ?? 0,
    nodeOutputs,
  }
}
