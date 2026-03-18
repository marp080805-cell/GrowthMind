const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    credentials: 'include',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Erro desconhecido' })) as { message?: string }
    throw new Error(error.message || `HTTP ${res.status}`)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
}

// Clients
export const clientsApi = {
  list: () => api.get<Client[]>('/clients'),
  get: (id: string) => api.get<Client>(`/clients/${id}`),
  create: (data: Partial<Client>) => api.post<Client>('/clients', data),
  update: (id: string, data: Partial<Client>) => api.put<Client>(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
  connectMeta: (id: string, token: string) =>
    api.post<{ accounts: MetaAccount[]; instagramAccounts: MetaInstagramAccount[] }>(`/clients/${id}/connect-meta`, { token }),
  getInstagramAccounts: (id: string, token: string, ad_account_id: string) =>
    api.post<{ instagram_accounts: MetaInstagramAccount[] }>(`/clients/${id}/instagram-accounts`, { token, ad_account_id }),
  getMetaAccounts: (id: string) =>
    api.get<{ accounts: MetaAccount[]; instagramAccounts: MetaInstagramAccount[] }>(`/clients/${id}/meta-accounts`),
}

// Campaigns
export const campaignsApi = {
  list: (clientId: string) => api.get<Campaign[]>(`/clients/${clientId}/campaigns`),
  sync: (clientId: string) => api.post<Campaign[]>(`/clients/${clientId}/campaigns/sync`),
  updateContext: (clientId: string, campaignId: string, context: string) =>
    api.put(`/clients/${clientId}/campaigns/${campaignId}/context`, { context }),
}

// AdSets
export const adsetsApi = {
  list: (clientId: string, campaignId: string) =>
    api.get<AdSet[]>(`/clients/${clientId}/adsets?campaign_id=${encodeURIComponent(campaignId)}`),
}

// Facebook Pages
export const pagesApi = {
  list: (clientId: string) =>
    api.get<{ pages: { id: string; name: string }[] }>(`/clients/${clientId}/facebook-pages`),
  listFromSettings: () =>
    api.get<{ pages: { id: string; name: string }[] }>('/settings/facebook-pages'),
}

// Automations
export const automationsApi = {
  list: (clientId: string) => api.get<Automation[]>(`/clients/${clientId}/automations`),
  listAll: () => api.get<(Automation & { client_name: string })[]>('/automations'),
  get: (id: string) => api.get<AutomationWithNodes>(`/automations/${id}`),
  create: (clientId: string, data: Partial<Automation>) =>
    api.post<Automation>(`/clients/${clientId}/automations`, data),
  save: (id: string, data: { nodes: AutomationNode[]; edges: AutomationEdge[]; name?: string }) =>
    api.put(`/automations/${id}`, data),
  toggle: (id: string) => api.post<Automation>(`/automations/${id}/toggle`),
  run: (id: string) => api.post<{ executionId: string }>(`/automations/${id}/run`),
  runNode: (id: string, nodeId: string, inputData?: unknown) =>
    api.post<{
      output: unknown
      error?: string
      duration_ms: number
      nodeOutputs?: Record<string, { output: unknown; error?: string; duration_ms: number; input: unknown }>
    }>(`/automations/${id}/run-node`, { nodeId, inputData }),
  logs: (id: string) => api.get<ExecutionLog[]>(`/automations/${id}/logs`),
  delete: (id: string) => api.delete(`/automations/${id}`),
  duplicate: (id: string, targetClientId: string) =>
    api.post<Automation>(`/automations/${id}/duplicate`, { target_client_id: targetClientId }),
}

// Agents
export const agentsApi = {
  list: (clientId: string) => api.get<Agent[]>(`/clients/${clientId}/agents`),
  listAll: () => api.get<(Agent & { client_name: string })[]>('/agents'),
  create: (clientId: string, data: Partial<Agent>) =>
    api.post<Agent>(`/clients/${clientId}/agents`, data),
  update: (clientId: string, agentId: string, data: Partial<Agent>) =>
    api.put<Agent>(`/clients/${clientId}/agents/${agentId}`, data),
  delete: (clientId: string, agentId: string) =>
    api.delete(`/clients/${clientId}/agents/${agentId}`),
}

// Single execution (for live polling)
export const executionsApi = {
  get: (id: string) => api.get<ExecutionLog>(`/executions/${id}`),
}

// Presets
export const presetsApi = {
  list: () => api.get<Preset[]>('/presets'),
  apply: (presetId: string, clientId: string) =>
    api.post<Automation>('/presets/apply', { presetId, clientId }),
  createFromAutomation: (data: { automation_id: string; name: string; description?: string; icon?: string; tags?: string[] }) =>
    api.post<Preset>('/presets/from-automation', data),
  delete: (id: string) => api.delete(`/presets/${id}`),
}

// Users
export const usersApi = {
  list: () => api.get<User[]>('/users'),
  create: (data: Partial<User>) => api.post<User>('/users', data),
  update: (id: string, data: Partial<User>) => api.put<User>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
}

// Settings
export const settingsApi = {
  get: () => api.get<Settings>('/settings'),
  update: (data: Partial<Settings>) => api.put<Settings>('/settings', data),
  test: (service: string, data?: Partial<Settings>) => api.post<{ ok: boolean; message: string }>(`/settings/test/${service}`, data),
  getModels: () => api.get<AIModel[]>('/settings/models'),
  updateModels: (models: AIModel[]) => api.put<AIModel[]>('/settings/models', { models }),
  getMetaAccounts: () => api.get<{ accounts: MetaAccount[]; instagramAccounts: MetaInstagramAccount[] }>('/settings/meta-accounts'),
}

// Types
export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'manager'
  is_active: boolean
  created_at: string
}

export interface Client {
  id: string
  user_id: string
  name: string
  business_type: string
  whatsapp: string
  context: string
  ad_account_id: string
  meta_token: string
  instagram_account_id: string
  facebook_page_id?: string
  status: 'active' | 'paused'
  created_at: string
  automations_count?: number
  last_execution?: string
}

export interface MetaAccount {
  id: string
  name: string
  currency: string
}

export interface MetaInstagramAccount {
  id: string
  name: string
  username: string
}

export interface Campaign {
  id: string
  client_id: string
  meta_campaign_id: string
  name: string
  status: string
  objective: string
  budget: number
  context: string
  synced_at: string
}

export interface AdSet {
  id: string
  name: string
  status: string
  campaign_id: string
  daily_budget?: string
  lifetime_budget?: string
  optimization_goal?: string
}

export interface Automation {
  id: string
  client_id: string
  name: string
  description: string
  is_active: boolean
  last_run_at: string
  created_at: string
}

export interface AutomationNode {
  id: string
  type: string
  label: string
  config: Record<string, unknown>
  position: { x: number; y: number }
}

export interface AutomationEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  data?: Record<string, unknown>
}

export interface AutomationWithNodes extends Automation {
  nodes: AutomationNode[]
  edges: AutomationEdge[]
}

export interface ExecutionLog {
  id: string
  automation_id: string
  status: 'running' | 'success' | 'error'
  started_at: string
  finished_at: string
  log_data: NodeLog[]
}

export interface NodeLog {
  node_id: string
  node_type: string
  node_label: string
  status: 'running' | 'success' | 'error' | 'skipped'
  input: unknown
  output: unknown
  error?: string
  duration_ms: number
}

export interface Agent {
  id: string
  client_id: string
  automation_node_id?: string
  name: string
  model: string
  system_prompt: string
  human_message: string
  temperature: number
  max_tokens: number
  output_format: 'text' | 'json'
  output_schema?: Record<string, unknown>
  memory_enabled: boolean
  created_at: string
}

export interface Preset {
  id: string
  name: string
  description: string
  icon: string
  tags: string[]
  nodes: AutomationNode[]
  edges: AutomationEdge[]
  is_system: boolean
  created_at: string
}

export interface Settings {
  id: string
  meta_token: string
  whatsapp_token: string
  whatsapp_url: string
  whatsapp_number: string
  whatsapp_instance: string
  openai_key: string
  anthropic_key: string
  notion_token: string
  drive_token: string
  available_models: AIModel[]
  updated_at: string
}

export interface AIModel {
  id: string
  provider: 'openai' | 'anthropic'
  slug: string
  display_name: string
  is_active: boolean
}
