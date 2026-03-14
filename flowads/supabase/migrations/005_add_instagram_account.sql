-- Migration: 005_add_instagram_account.sql
-- Adds instagram_account_id to clients table

ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram_account_id text;
