-- Atualiza preset "Sincronizar Posts Instagram" com fluxo completo e visual
-- Migration: 007_update_instagram_preset.sql
-- Fluxo: agendamento → buscar posts → verificar se tem posts (se não → parar) → criar anúncios

UPDATE presets
SET
  description = 'Verifica diariamente posts Instagram novos e cria anúncios automaticamente para os não patrocinados',
  nodes = '[
    {
      "id": "n1",
      "type": "trigger.schedule",
      "label": "Todo dia às 10h",
      "config": {"frequency": "daily", "time": "10:00"},
      "position": {"x": 250, "y": 50}
    },
    {
      "id": "n2",
      "type": "meta.fetch_instagram_posts",
      "label": "Buscar posts recentes",
      "config": {"period": "30d", "limit": 50},
      "position": {"x": 250, "y": 200}
    },
    {
      "id": "n3",
      "type": "logic.if",
      "label": "Tem posts novos?",
      "config": {"variable": "total", "operator": ">", "value": "0"},
      "position": {"x": 250, "y": 350}
    },
    {
      "id": "n4",
      "type": "meta.create_ads_from_new_posts",
      "label": "Criar anúncios de posts novos",
      "config": {"adset_id": "", "status": "ACTIVE"},
      "position": {"x": 100, "y": 500}
    },
    {
      "id": "n5",
      "type": "logic.stop",
      "label": "Nenhum post novo",
      "config": {},
      "position": {"x": 420, "y": 500}
    }
  ]'::jsonb,
  edges = '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e3", "source": "n3", "target": "n4", "sourceHandle": "true",    "targetHandle": "default"},
    {"id": "e4", "source": "n3", "target": "n5", "sourceHandle": "false",   "targetHandle": "default"}
  ]'::jsonb
WHERE name = 'Sincronizar Posts Instagram';
