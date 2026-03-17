-- Fix missing ON DELETE CASCADE on execution_logs and agent_memory

-- 1. execution_logs.automation_id → add CASCADE
ALTER TABLE execution_logs
  DROP CONSTRAINT IF EXISTS execution_logs_automation_id_fkey;
ALTER TABLE execution_logs
  ADD CONSTRAINT execution_logs_automation_id_fkey
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE;

-- 2. agent_memory.client_id → add CASCADE
ALTER TABLE agent_memory
  DROP CONSTRAINT IF EXISTS agent_memory_client_id_fkey;
ALTER TABLE agent_memory
  ADD CONSTRAINT agent_memory_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
