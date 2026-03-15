-- Atualiza preset "Sincronizar Posts Instagram" com novo fluxo
-- Migration: 007_update_instagram_preset.sql
-- Fluxo: agendamento → buscar posts → criar anúncios de posts novos (com deduplicação)

UPDATE presets
SET
  description = 'Verifica diariamente posts Instagram novos e cria anúncios automaticamente para os não patrocinados',
  nodes = '[
    {"id": "n1", "type": "trigger.schedule", "label": "Todo dia às 10h", "config": {"frequency": "daily", "time": "10:00"}, "position": {"x": 250, "y": 50}},
    {"id": "n2", "type": "meta.fetch_instagram_posts", "label": "Buscar posts recentes", "config": {"period": "30d", "limit": 50}, "position": {"x": 250, "y": 200}},
    {"id": "n3", "type": "meta.create_ads_from_new_posts", "label": "Criar anúncios de posts novos", "config": {"adset_id": "", "status": "ACTIVE"}, "position": {"x": 250, "y": 350}}
  ]'::jsonb,
  edges = '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"}
  ]'::jsonb
WHERE name = 'Sincronizar Posts Instagram';
