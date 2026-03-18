-- Add data column to automation_edges to persist edge layout (midOffset, etc.)
ALTER TABLE automation_edges ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
