-- Add whatsapp_instance column to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS whatsapp_instance text;
