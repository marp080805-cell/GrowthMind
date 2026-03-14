import { supabase } from '../lib/supabase'
import type {
  AutomationNode, AutomationEdge, ExecutionContext,
  NodeLog, ExecutionLog, Client, Campaign, Settings
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
      val = (val as Record<string, unknown>)?.[k]
    }
    if (val === undefined || val === null) return ''
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  })
}

function interpolateConfig(config: Record<string, unknown>, vars: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'string') {
      result[k] = interpolate(v, vars)
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

  const executionId = logRecord!.id
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
      hoje: new Date().toLocaleDateString('pt-BR'),
      semana_atual: `semana de ${getWeekRange()}`,
      mes_atual: new Date().toLocaleDateString('pt-BR', { month: 'long' }),
      data_formatada: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      cliente: client ? {
        nome: client.name,
        tipo_negocio: client.business_type,
        contexto: client.context,
        whatsapp: client.whatsapp,
      } : {},
      campanhas: {
        todas: context.campaigns,
      },
      input: triggerPayload,
    }

    let lastOutput: unknown = triggerPayload

    // Execute each node
    for (const node of ordered) {
      if (node.type.startsWith('trigger.')) {
        // Triggers are just starting points
        nodeLogs.push({
          node_id: node.id,
          node_type: node.type,
          node_label: node.label || node.type,
          status: 'success',
          input: triggerPayload,
          output: triggerPayload,
          duration_ms: 0,
        })
        continue
      }

      const startTime = Date.now()
      const interpolatedConfig = interpolateConfig(node.config, templateVars)

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
          input: lastOutput,
          output,
          duration_ms: duration,
        })

        await updateLog('running')
      } catch (err) {
        const duration = Date.now() - startTime
        const message = err instanceof Error ? err.message : String(err)

        nodeLogs.push({
          node_id: node.id,
          node_type: node.type,
          node_label: node.label || node.type,
          status: 'error',
          input: lastOutput,
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
    throw err
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
    default:
      return input
  }
}

async function executeMeta(
  action: string,
  config: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<unknown> {
  const token = context.client?.meta_token || context.settings.meta_token
  if (!token) throw new Error('Token Meta não configurado')

  const meta = new MetaService(token, context.client?.ad_account_id)

  switch (action) {
    case 'fetch_campaigns': {
      const campaigns = await meta.getCampaigns()
      return { campanhas: campaigns }
    }
    case 'fetch_metrics': {
      const period = (config.period as string) || '7d'
      const periodMap: Record<string, string> = {
        '7d': 'last_7_days',
        '14d': 'last_14_days',
        '30d': 'last_30_days',
        'this_month': 'this_month',
      }
      const metrics = await meta.getMetrics(
        null,
        periodMap[period] || period,
        (config.metrics as string[]) || [],
        config.breakdown as string
      )
      return { metricas: metrics }
    }
    case 'pause_ad': {
      await meta.pauseAd(config.ad_id as string)
      return { paused: true }
    }
    case 'activate_ad': {
      await meta.activateAd(config.ad_id as string)
      return { activated: true }
    }
    case 'adjust_budget': {
      await meta.updateBudget(config.campaign_id as string, config.budget as number)
      return { updated: true }
    }
    default:
      return input
  }
}

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
    case 'if': {
      const { variable, operator, value } = config as Record<string, string>
      const actual = String(input)
      let result = false
      switch (operator) {
        case '>': result = parseFloat(actual) > parseFloat(value); break
        case '<': result = parseFloat(actual) < parseFloat(value); break
        case '>=': result = parseFloat(actual) >= parseFloat(value); break
        case '<=': result = parseFloat(actual) <= parseFloat(value); break
        case '=': result = actual === value; break
        case '!=': result = actual !== value; break
        case 'contains': result = actual.includes(value); break
        case 'not_contains': result = !actual.includes(value); break
        case 'is_empty': result = !actual || actual === 'null' || actual === 'undefined'; break
        case 'not_empty': result = !!actual && actual !== 'null' && actual !== 'undefined'; break
      }
      return { condition: result, input }
    }
    case 'transform': {
      const template = config.template as string
      if (template) {
        try { return JSON.parse(template) } catch { return template }
      }
      return input
    }
    case 'filter': {
      if (Array.isArray(input)) {
        return input.filter((item) => {
          if (!config.condition) return true
          return true // Simplified - full expression eval would be complex
        })
      }
      return input
    }
    case 'stop':
      throw new Error('FLOW_STOPPED')
    default:
      return input
  }
}

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
      console.log('[FlowAds Log]', input)
      return input
    }
    default:
      return input
  }
}

async function executeNotion(
  action: string,
  _config: Record<string, unknown>,
  input: unknown,
  _context: ExecutionContext
): Promise<unknown> {
  // Notion integration requires OAuth - returns placeholder
  console.warn('Notion integration not fully configured')
  return input
}

async function executeDrive(
  action: string,
  _config: Record<string, unknown>,
  input: unknown,
  _context: ExecutionContext
): Promise<unknown> {
  // Drive integration requires OAuth - returns placeholder
  console.warn('Google Drive integration not fully configured')
  return input
}
