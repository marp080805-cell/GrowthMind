-- Migration: 018_seed_instagram_switch_ads_preset
-- Description: Template "Anúncios por palavra-chave na legenda" — Switch roteia cada post para campanha específica
-- Created: 2026-04-02

INSERT INTO presets (id, name, description, icon, tags, nodes, edges, is_system)
VALUES (
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'Anúncios por palavra-chave na legenda',
  'Busca posts do Instagram, filtra não patrocinados e roteia cada post para uma campanha específica com base em palavras-chave na legenda. Configure as palavras-chave e as campanhas de cada caso.',
  '🔀',
  '["instagram", "meta", "anúncios", "switch", "loop", "whatsapp", "palavra-chave"]'::jsonb,
  '[
    {"id":"s01","type":"trigger.schedule","label":"Agendamento","config":{"time":"19:00"},"position":{"x":500,"y":0}},
    {"id":"s02","type":"meta.fetch_instagram_posts","label":"Buscar posts Instagram","config":{},"position":{"x":500,"y":150}},
    {"id":"s03","type":"logic.if","label":"Tem posts?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":500,"y":300}},
    {"id":"s04","type":"meta.filter_unsponsored_posts","label":"Filtrar posts não patrocinados","config":{"source_posts":"{{posts}}"},"position":{"x":300,"y":450}},
    {"id":"s05","type":"logic.stop","label":"Nenhum post encontrado","config":{},"position":{"x":700,"y":450}},
    {"id":"s06","type":"logic.if","label":"Tem posts novos?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":300,"y":600}},
    {"id":"s07","type":"logic.stop","label":"Nenhum post novo","config":{},"position":{"x":500,"y":750}},
    {"id":"s08","type":"logic.loop","label":"Loop","config":{"list":"{{posts}}"},"position":{"x":100,"y":750}},
    {"id":"s09","type":"logic.switch","label":"Verificar palavra-chave","config":{"variable":"{{item.caption}}","cases":[{"id":"case_a","label":"Caso 1","value":"palavra1"},{"id":"case_b","label":"Caso 2","value":"palavra2"}]},"position":{"x":100,"y":900}},
    {"id":"s10","type":"meta.create_ad","label":"Criar anúncio Caso 1","config":{"creative_type":"instagram_post","source_instagram_media_id":"{{item.id}}","adset_id":"","campaign_id":"","name":"Post {{item.id}} - Caso 1"},"position":{"x":-200,"y":1060}},
    {"id":"s11","type":"meta.create_ad","label":"Criar anúncio Caso 2","config":{"creative_type":"instagram_post","source_instagram_media_id":"{{item.id}}","adset_id":"","campaign_id":"","name":"Post {{item.id}} - Caso 2"},"position":{"x":100,"y":1060}},
    {"id":"s12","type":"meta.create_ad","label":"Criar anúncio Padrão","config":{"creative_type":"instagram_post","source_instagram_media_id":"{{item.id}}","adset_id":"","campaign_id":"","name":"Post {{item.id}} - Padrão"},"position":{"x":400,"y":1060}},
    {"id":"s13","type":"logic.if","label":"Anúncio criado?","config":{"operator":"not_empty","variable":"ad_id"},"position":{"x":100,"y":1220}},
    {"id":"s14","type":"whatsapp.send_message","label":"Notificar erro","config":{"message":"❌ *Falha ao criar anúncio {{cliente.nome}}*\n\n🔗 Post: {{post_permalink}}\n📝 Legenda: {{post_caption}}\n📸 Tipo: {{post_media_type}}\n\n⚠️ Motivo: {{motivo}}\n🛠️ Erro técnico: {{erro_meta}}\n\n▶️ Acesse o post para subir manualmente."},"position":{"x":350,"y":1380}},
    {"id":"s16","type":"whatsapp.send_message","label":"Notificar sucesso","config":{"message":"✅ *Anúncio criado — {{cliente.nome}}*\n\n🔗 {{post_permalink}}\n📝 {{post_caption}}"},"position":{"x":-150,"y":1380}},
    {"id":"s15","type":"whatsapp.send_message","label":"Loop concluído","config":{"message":"✅ *Loop de anúncios — {{cliente.nome}}*\n\n📊 Posts processados: {{loop_total}}"},"position":{"x":650,"y":900}}
  ]'::jsonb,
  '[
    {"id":"se01","source":"s01","target":"s02","sourceHandle":"default","targetHandle":"default"},
    {"id":"se02","source":"s02","target":"s03","sourceHandle":"default","targetHandle":"default"},
    {"id":"se03","source":"s03","target":"s04","sourceHandle":"yes","targetHandle":"default"},
    {"id":"se04","source":"s03","target":"s05","sourceHandle":"no","targetHandle":"default"},
    {"id":"se05","source":"s04","target":"s06","sourceHandle":"default","targetHandle":"default"},
    {"id":"se06","source":"s06","target":"s08","sourceHandle":"yes","targetHandle":"default"},
    {"id":"se07","source":"s06","target":"s07","sourceHandle":"no","targetHandle":"default"},
    {"id":"se08","source":"s08","target":"s09","sourceHandle":"each","targetHandle":"default"},
    {"id":"se09","source":"s09","target":"s10","sourceHandle":"case_a","targetHandle":"default"},
    {"id":"se10","source":"s09","target":"s11","sourceHandle":"case_b","targetHandle":"default"},
    {"id":"se11","source":"s09","target":"s12","sourceHandle":"default","targetHandle":"default"},
    {"id":"se12","source":"s10","target":"s13","sourceHandle":"default","targetHandle":"default"},
    {"id":"se13","source":"s11","target":"s13","sourceHandle":"default","targetHandle":"default"},
    {"id":"se14","source":"s12","target":"s13","sourceHandle":"default","targetHandle":"default"},
    {"id":"se15","source":"s13","target":"s14","sourceHandle":"no","targetHandle":"default"},
    {"id":"se16","source":"s13","target":"s16","sourceHandle":"yes","targetHandle":"default"},
    {"id":"se17","source":"s14","target":"s08","sourceHandle":"default","targetHandle":"default"},
    {"id":"se19","source":"s16","target":"s08","sourceHandle":"default","targetHandle":"default"},
    {"id":"se18","source":"s08","target":"s15","sourceHandle":"done","targetHandle":"default"}
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;
