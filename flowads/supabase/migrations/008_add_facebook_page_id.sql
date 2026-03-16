-- Migration: 008_add_facebook_page_id.sql
-- Adds facebook_page_id to clients table

ALTER TABLE clients ADD COLUMN IF NOT EXISTS facebook_page_id text;
