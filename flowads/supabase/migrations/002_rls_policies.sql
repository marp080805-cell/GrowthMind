-- Row Level Security Policies
-- Migration: 002_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by backend)
-- All policies use service_role which bypasses RLS

-- For anon/authenticated users reading presets (public gallery)
CREATE POLICY "presets_read_all" ON presets
  FOR SELECT USING (true);

-- For authenticated users
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

CREATE POLICY "clients_read_all_authenticated" ON clients
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "campaigns_read_all_authenticated" ON campaigns
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "automations_read_all_authenticated" ON automations
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "nodes_read_all_authenticated" ON automation_nodes
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "edges_read_all_authenticated" ON automation_edges
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "logs_read_all_authenticated" ON execution_logs
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "agents_read_all_authenticated" ON agents
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "settings_read_all_authenticated" ON settings
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "memory_read_all_authenticated" ON agent_memory
  FOR ALL USING (auth.uid() IS NOT NULL);
