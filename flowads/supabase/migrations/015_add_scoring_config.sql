-- Migration: 015_add_scoring_config.sql
-- Adds per-client scoring configuration for the evaluate_campaign_performance block

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS scoring_config jsonb DEFAULT '{}';
