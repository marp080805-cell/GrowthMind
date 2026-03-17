-- Remove all system seed presets (is_system = true)
-- Only user-created templates (is_system = false) will remain
DELETE FROM presets WHERE is_system = true;
