-- FlowAds Initial Schema
-- Migration: 001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users / Gestores
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text CHECK (role IN ('admin', 'manager')) DEFAULT 'manager',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  name text NOT NULL,
  business_type text,
  whatsapp text,
  context text,
  ad_account_id text,
  meta_token text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Campanhas (sincronizadas da Meta API)
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  meta_campaign_id text NOT NULL,
  name text NOT NULL,
  status text,
  objective text,
  budget numeric,
  context text,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(client_id, meta_campaign_id)
);

-- Automações
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Nós do builder
CREATE TABLE IF NOT EXISTS automation_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  type text NOT NULL,
  label text,
  config jsonb DEFAULT '{}',
  position_x numeric DEFAULT 0,
  position_y numeric DEFAULT 0
);

-- Edges (conexões entre blocos)
CREATE TABLE IF NOT EXISTS automation_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  source_node_id uuid REFERENCES automation_nodes(id) ON DELETE CASCADE,
  target_node_id uuid REFERENCES automation_nodes(id) ON DELETE CASCADE,
  source_handle text DEFAULT 'default',
  target_handle text DEFAULT 'default'
);

-- Logs de execução
CREATE TABLE IF NOT EXISTS execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id),
  status text CHECK (status IN ('running', 'success', 'error')),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  log_data jsonb DEFAULT '[]'
);

-- Agentes de IA
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  automation_node_id uuid REFERENCES automation_nodes(id) ON DELETE SET NULL,
  name text NOT NULL,
  model text NOT NULL,
  system_prompt text,
  human_message text,
  temperature numeric DEFAULT 0.7,
  max_tokens integer DEFAULT 1000,
  output_format text DEFAULT 'text',
  output_schema jsonb,
  memory_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Presets
CREATE TABLE IF NOT EXISTS presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  tags jsonb DEFAULT '[]',
  nodes jsonb NOT NULL DEFAULT '[]',
  edges jsonb NOT NULL DEFAULT '[]',
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Configurações globais
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_token text,
  whatsapp_token text,
  whatsapp_url text,
  whatsapp_number text,
  openai_key text,
  anthropic_key text,
  notion_token text,
  drive_token text,
  available_models jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now()
);

-- Histórico de memória dos agentes
CREATE TABLE IF NOT EXISTS agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id),
  execution_id uuid REFERENCES execution_logs(id),
  role text,
  content text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_automations_client_id ON automations(client_id);
CREATE INDEX IF NOT EXISTS idx_automation_nodes_automation_id ON automation_nodes(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_edges_automation_id ON automation_edges(automation_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_automation_id ON execution_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_started_at ON execution_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_client_id ON agents(client_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_id ON agent_memory(agent_id);
