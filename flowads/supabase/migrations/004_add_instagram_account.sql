-- Migration: 004_add_instagram_account
-- Description: Adiciona coluna instagram_account_id na tabela clients para armazenar o perfil Instagram da BM
-- Created: 2026-03-14

-- ====================
-- UP (aplicar)
-- ====================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram_account_id text;

-- ====================
-- ROLLBACK (reverter — comentado, para referência)
-- ====================
-- ALTER TABLE clients DROP COLUMN IF EXISTS instagram_account_id;
