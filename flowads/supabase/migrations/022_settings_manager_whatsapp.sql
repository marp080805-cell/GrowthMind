-- Migration: 022_settings_manager_whatsapp
-- Description: Adiciona campo manager_whatsapp na tabela settings para o Jarvis enviar briefings diários
-- Created: 2026-04-02

ALTER TABLE settings ADD COLUMN IF NOT EXISTS manager_whatsapp text DEFAULT '';

-- ROLLBACK:
-- ALTER TABLE settings DROP COLUMN IF EXISTS manager_whatsapp;
