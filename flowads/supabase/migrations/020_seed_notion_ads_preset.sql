-- Migration: 020_seed_notion_ads_preset
-- Description: Template "Criar anúncios a partir do Notion" — webhook recebe array do Notion, faz upload do Drive e cria anúncio na Meta
-- Created: 2026-04-02

INSERT INTO presets (id, name, description, icon, tags, nodes, edges, is_system)
VALUES (
  'e5f6a7b8-c9d0-1234-efab-345678901234',
  'Criar anúncios a partir do Notion',
  'Recebe via webhook um array de criativos do Notion (nome, título, texto e link do Drive), faz upload de cada criativo para a Meta e cria o anúncio automaticamente. Requer link do Drive compartilhado como "qualquer pessoa com o link".',
  '📋',
  '["notion", "meta", "anúncios", "webhook", "drive", "upload", "whatsapp"]'::jsonb,
  '[
    {"id":"w01","type":"trigger.webhook","label":"Webhook","config":{},"position":{"x":300,"y":0}},
    {"id":"w02","type":"logic.loop","label":"Loop","config":{"list":"{{body}}"},"position":{"x":300,"y":150}},
    {"id":"w03","type":"meta.upload_creative","label":"Upload criativo","config":{"drive_url":"{{item.drive_url}}"},"position":{"x":150,"y":310}},
    {"id":"w04","type":"meta.create_ad","label":"Criar anúncio","config":{"creative_type":"uploaded","name":"{{item.nome}}","title":"{{item.titulo}}","body":"{{item.texto}}","adset_id":"","campaign_id":"","page_id":"","call_to_action":"LEARN_MORE"},"position":{"x":150,"y":470}},
    {"id":"w05","type":"logic.if","label":"Anúncio criado?","config":{"variable":"ad_id","operator":"not_empty","value":""},"position":{"x":150,"y":630}},
    {"id":"w06","type":"whatsapp.send_message","label":"Notificar erro","config":{"message":"❌ *Erro ao criar anúncio — {{cliente.nome}}*\n\n📛 Anúncio: {{item.nome}}\n🔗 Drive: {{item.drive_url}}\n\n⚠️ Verifique o criativo e tente novamente."},"position":{"x":380,"y":790}},
    {"id":"w07","type":"whatsapp.send_message","label":"Anúncios criados","config":{"message":"✅ *Anúncios criados — {{cliente.nome}}*\n\n📊 Criativos enviados: {{loop_total}}"},"position":{"x":580,"y":310}}
  ]'::jsonb,
  '[
    {"id":"we01","source":"w01","target":"w02","sourceHandle":"default","targetHandle":"default"},
    {"id":"we02","source":"w02","target":"w03","sourceHandle":"each","targetHandle":"default"},
    {"id":"we03","source":"w03","target":"w04","sourceHandle":"default","targetHandle":"default"},
    {"id":"we04","source":"w04","target":"w05","sourceHandle":"default","targetHandle":"default"},
    {"id":"we05","source":"w05","target":"w02","sourceHandle":"yes","targetHandle":"default"},
    {"id":"we06","source":"w05","target":"w06","sourceHandle":"no","targetHandle":"default"},
    {"id":"we07","source":"w06","target":"w02","sourceHandle":"default","targetHandle":"default"},
    {"id":"we08","source":"w02","target":"w07","sourceHandle":"done","targetHandle":"default"}
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;
