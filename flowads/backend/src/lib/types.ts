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
  instagram_account_id?: string
  facebook_page_id?: string
  status: 'active' | 'paused'
  created_at: string
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

export interface Automation {
  id: string
  client_id: string
  name: string
  description: string
  is_active: boolean
  last_run_at: string
  created_at: string
  nodes?: AutomationNode[]
  edges?: AutomationEdge[]
}

export interface AutomationNode {
  id: string
  automation_id?: string
  type: string
  label?: string
  config: Record<string, unknown>
  position_x?: number
  position_y?: number
  position?: { x: number; y: number }
}

export interface AutomationEdge {
  id: string
  automation_id?: string
  source: string
  target: string
  source_node_id?: string
  target_node_id?: string
  sourceHandle?: string
  targetHandle?: string
  source_handle?: string
  target_handle?: string
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

export interface ExecutionLog {
  id: string
  automation_id: string
  status: 'running' | 'success' | 'error'
  started_at: string
  finished_at?: string
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

export interface Settings {
  id: string
  meta_token?: string
  whatsapp_token?: string
  whatsapp_url?: string
  whatsapp_number?: string
  whatsapp_instance?: string
  openai_key?: string
  anthropic_key?: string
  notion_token?: string
  drive_token?: string
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

export interface ExecutionContext {
  client: Client | null
  campaigns: Campaign[]
  settings: Settings
  executionId: string
  triggerPayload?: unknown
}
