-- Migration: 016_clear_all_presets
-- Description: Remove todos os presets de sistema (is_system = true)
-- Created: 2026-04-02

DELETE FROM presets WHERE is_system = true;
