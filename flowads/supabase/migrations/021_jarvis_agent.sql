-- Migration: 021_jarvis_agent
-- Description: Tabelas para o agente Jarvis — sessões, histórico de mensagens, memória aprendida e ações pendentes
-- Created: 2026-04-02

-- Sessão única do agente (contexto persistente entre conversas)
CREATE TABLE IF NOT EXISTS jarvis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Contexto atual
  current_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  current_client_name text,
  current_campaign_id text,
  current_campaign_name text,
  current_adset_id text,
  current_adset_name text,
  -- Estado da conversa
  state text DEFAULT 'idle',
  -- idle | selecting_client | selecting_campaign | selecting_adset | collecting_creative | awaiting_confirmation
  pending_action jsonb DEFAULT '{}'::jsonb,
  -- Metadados
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Uma sessão global (singleton) — sempre usar upsert com id fixo
INSERT INTO jarvis_sessions (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Histórico completo de mensagens
CREATE TABLE IF NOT EXISTS jarvis_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES jarvis_sessions(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text NOT NULL,
  -- Se foi uma chamada de ferramenta
  tool_name text,
  tool_input jsonb,
  tool_result jsonb,
  -- Canal de origem
  channel text DEFAULT 'platform' CHECK (channel IN ('platform', 'whatsapp')),
  -- Se veio de áudio transcrito
  was_audio boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jarvis_messages_session ON jarvis_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jarvis_messages_created ON jarvis_messages(created_at DESC);

-- Memória aprendida — fatos que o agente acumula ao longo do tempo
CREATE TABLE IF NOT EXISTS jarvis_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Categorias: client_preference | default | procedure | contact | restriction
  category text NOT NULL DEFAULT 'general',
  -- Chave semântica (ex: "beleza_natural_campanha_padrao", "orcamento_padrao_vaga")
  key text NOT NULL,
  -- Valor em texto livre (ex: "Campanha: Prospecção / Conjunto: Amplo SP / Budget: R$50/dia")
  value text NOT NULL,
  -- Cliente associado (se for preferência de cliente específico)
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  client_name text,
  -- Metadados
  learned_from text, -- trecho da mensagem que gerou esse aprendizado
  times_used integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(key, client_id)
);

CREATE INDEX IF NOT EXISTS idx_jarvis_memory_category ON jarvis_memory(category);
CREATE INDEX IF NOT EXISTS idx_jarvis_memory_client ON jarvis_memory(client_id);

-- Ações pendentes de confirmação (sim/não)
CREATE TABLE IF NOT EXISTS jarvis_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES jarvis_sessions(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
  -- Tipo de ação
  action_type text NOT NULL,
  -- Ex: boost_post, pause_ads, create_ad, adjust_budget
  action_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Descrição amigável mostrada para o usuário confirmar
  description text NOT NULL,
  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'executed', 'expired')),
  -- Expiração (15 minutos)
  expires_at timestamptz DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jarvis_pending_session ON jarvis_pending_actions(session_id, status);

-- Log de todas as ações executadas pelo Jarvis (auditoria)
CREATE TABLE IF NOT EXISTS jarvis_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES jarvis_sessions(id) ON DELETE SET NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name text,
  -- O que foi feito
  action_type text NOT NULL,
  action_params jsonb,
  -- Resultado
  success boolean,
  result jsonb,
  error_message text,
  -- Canal
  channel text DEFAULT 'platform',
  executed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jarvis_log_client ON jarvis_action_log(client_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_jarvis_log_executed ON jarvis_action_log(executed_at DESC);
