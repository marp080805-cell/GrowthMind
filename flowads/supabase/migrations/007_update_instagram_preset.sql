-- Atualiza preset "Sincronizar Posts Instagram" com fluxo completo e visual
-- Migration: 007_update_instagram_preset.sql
-- Fluxo: agendamento → buscar posts → tem posts? → filtrar patrocinados → tem novos? → criar anúncio / parar

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
      "label": "Tem posts?",
      "config": {"variable": "total", "operator": ">", "value": "0"},
      "position": {"x": 250, "y": 350}
    },
    {
      "id": "n4",
      "type": "meta.filter_unsponsored_posts",
      "label": "Filtrar não patrocinados",
      "config": {},
      "position": {"x": 100, "y": 500}
    },
    {
      "id": "n5",
      "type": "logic.if",
      "label": "Tem posts novos?",
      "config": {"variable": "total", "operator": ">", "value": "0"},
      "position": {"x": 100, "y": 650}
    },
    {
      "id": "n6",
      "type": "meta.create_ad",
      "label": "Criar anúncio com post",
      "config": {"creative_type": "instagram_post", "source_instagram_media_id": "{{posts.[0].id}}", "status": "ACTIVE"},
      "position": {"x": -80, "y": 800}
    },
    {
      "id": "n7",
      "type": "logic.stop",
      "label": "Nenhum post novo",
      "config": {},
      "position": {"x": 280, "y": 800}
    },
    {
      "id": "n8",
      "type": "logic.stop",
      "label": "Nenhum post encontrado",
      "config": {},
      "position": {"x": 420, "y": 500}
    }
  ]'::jsonb,
  edges = '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e3", "source": "n3", "target": "n4", "sourceHandle": "true",    "targetHandle": "default"},
    {"id": "e4", "source": "n3", "target": "n8", "sourceHandle": "false",   "targetHandle": "default"},
    {"id": "e5", "source": "n4", "target": "n5", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e6", "source": "n5", "target": "n6", "sourceHandle": "true",    "targetHandle": "default"},
    {"id": "e7", "source": "n5", "target": "n7", "sourceHandle": "false",   "targetHandle": "default"}
  ]'::jsonb
WHERE name = 'Sincronizar Posts Instagram';
