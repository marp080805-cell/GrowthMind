-- Migration: 028_update_presets_notify_ineligible_posts
-- Description: Separa filtro de posts patrocinados e elegibilidade em dois nodes distintos.
--   1. filter_unsponsored_posts → só verifica se já tem anúncio ativo
--   2. filter_eligible_posts (NOVO) → verifica boost_eligibility_info
--   Fluxo: filter_unsponsored → IF elegíveis → filter_eligible → IF inelegiveis
--          → Loop(posts_inelegiveis) → WhatsApp por post → Loop principal
-- Created: 2026-04-09

-- ── Preset 017: Criar anúncios com posts do Instagram (loop simples) ──────────
UPDATE presets SET
  nodes = '[
    {"id":"n01","type":"trigger.schedule","label":"Agendamento","config":{"time":"19:00"},"position":{"x":400,"y":0}},
    {"id":"n02","type":"meta.fetch_instagram_posts","label":"Buscar posts Instagram","config":{},"position":{"x":400,"y":150}},
    {"id":"n03","type":"logic.if","label":"Tem posts?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":400,"y":300}},
    {"id":"n04","type":"meta.filter_unsponsored_posts","label":"Filtrar posts não patrocinados","config":{"source_posts":"{{posts}}"},"position":{"x":230,"y":450}},
    {"id":"n05","type":"logic.stop","label":"Nenhum post encontrado","config":{},"position":{"x":580,"y":450}},
    {"id":"n06","type":"logic.if","label":"Tem posts não patrocinados?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":230,"y":600}},
    {"id":"n07","type":"logic.stop","label":"Nenhum post novo","config":{},"position":{"x":450,"y":750}},
    {"id":"n16","type":"meta.filter_eligible_posts","label":"Filtrar posts elegíveis para boost","config":{},"position":{"x":80,"y":750}},
    {"id":"n14","type":"logic.if","label":"Tem posts inelegíveis?","config":{"value":"1","operator":">=","variable":"total_inelegiveis"},"position":{"x":80,"y":900}},
    {"id":"n17","type":"logic.loop","label":"Loop posts inelegíveis","config":{"list":"{{posts_inelegiveis}}"},"position":{"x":80,"y":1050}},
    {"id":"n18","type":"whatsapp.send_message","label":"Avisar post inelegível","config":{"message":"⚠️ *Post inelegível para boost — {{cliente.nome}}*\n\n📸 Post: {{item.id}}\n❌ Motivo: {{item.motivo}}\n\nAcesse o Meta Business Suite e suba este post manualmente como anúncio."},"position":{"x":80,"y":1200}},
    {"id":"n08","type":"logic.loop","label":"Loop posts elegíveis","config":{"list":"{{posts}}"},"position":{"x":80,"y":1350}},
    {"id":"n09","type":"meta.create_ad","label":"Criar anúncio","config":{"creative_type":"instagram_post","source_instagram_media_id":"{{item.id}}","adset_id":"","campaign_id":"","name":"Post Instagram {{item.id}}"},"position":{"x":80,"y":1500}},
    {"id":"n10","type":"logic.if","label":"Anúncio criado?","config":{"operator":"not_empty","variable":"ad_id"},"position":{"x":80,"y":1650}},
    {"id":"n11","type":"whatsapp.send_message","label":"Notificar erro","config":{"message":"❌ *Falha ao criar anúncio {{cliente.nome}}*\n\n🔗 Post: {{post_permalink}}\n📝 Legenda: {{post_caption}}\n📸 Tipo: {{post_media_type}}\n\n⚠️ Motivo: {{motivo}}\n🛠️ Erro técnico: {{erro_meta}}\n\n▶️ Acesse o post para subir manualmente."},"position":{"x":300,"y":1800}},
    {"id":"n13","type":"whatsapp.send_message","label":"Notificar sucesso","config":{"message":"✅ *Anúncio criado — {{cliente.nome}}*\n\n🔗 {{post_permalink}}\n📝 {{post_caption}}"},"position":{"x":-150,"y":1800}},
    {"id":"n12","type":"whatsapp.send_message","label":"Loop concluído","config":{"message":"✅ *Loop de anúncios — {{cliente.nome}}*\n\n📊 Posts processados: {{loop_total}}"},"position":{"x":580,"y":1350}}
  ]'::jsonb,
  edges = '[
    {"id":"e01","source":"n01","target":"n02","sourceHandle":"default","targetHandle":"default"},
    {"id":"e02","source":"n02","target":"n03","sourceHandle":"default","targetHandle":"default"},
    {"id":"e03","source":"n03","target":"n04","sourceHandle":"yes","targetHandle":"default"},
    {"id":"e04","source":"n03","target":"n05","sourceHandle":"no","targetHandle":"default"},
    {"id":"e05","source":"n04","target":"n06","sourceHandle":"default","targetHandle":"default"},
    {"id":"e06","source":"n06","target":"n16","sourceHandle":"yes","targetHandle":"default"},
    {"id":"e07","source":"n06","target":"n07","sourceHandle":"no","targetHandle":"default"},
    {"id":"e16a","source":"n16","target":"n14","sourceHandle":"default","targetHandle":"default"},
    {"id":"e14a","source":"n14","target":"n17","sourceHandle":"yes","targetHandle":"default"},
    {"id":"e14b","source":"n14","target":"n08","sourceHandle":"no","targetHandle":"default"},
    {"id":"e17a","source":"n17","target":"n18","sourceHandle":"each","targetHandle":"default"},
    {"id":"e17b","source":"n17","target":"n08","sourceHandle":"done","targetHandle":"default"},
    {"id":"e08","source":"n08","target":"n09","sourceHandle":"each","targetHandle":"default"},
    {"id":"e09","source":"n09","target":"n10","sourceHandle":"default","targetHandle":"default"},
    {"id":"e10","source":"n10","target":"n11","sourceHandle":"no","targetHandle":"default"},
    {"id":"e11","source":"n10","target":"n13","sourceHandle":"yes","targetHandle":"default"},
    {"id":"e12","source":"n11","target":"n08","sourceHandle":"default","targetHandle":"default"},
    {"id":"e14","source":"n13","target":"n08","sourceHandle":"default","targetHandle":"default"},
    {"id":"e13","source":"n08","target":"n12","sourceHandle":"done","targetHandle":"default"}
  ]'::jsonb
WHERE id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

-- ── Preset 018: Anúncios por palavra-chave na legenda (switch) ────────────────
UPDATE presets SET
  nodes = '[
    {"id":"s01","type":"trigger.schedule","label":"Agendamento","config":{"time":"19:00"},"position":{"x":500,"y":0}},
    {"id":"s02","type":"meta.fetch_instagram_posts","label":"Buscar posts Instagram","config":{},"position":{"x":500,"y":150}},
    {"id":"s03","type":"logic.if","label":"Tem posts?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":500,"y":300}},
    {"id":"s04","type":"meta.filter_unsponsored_posts","label":"Filtrar posts não patrocinados","config":{"source_posts":"{{posts}}"},"position":{"x":300,"y":450}},
    {"id":"s05","type":"logic.stop","label":"Nenhum post encontrado","config":{},"position":{"x":700,"y":450}},
    {"id":"s06","type":"logic.if","label":"Tem posts não patrocinados?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":300,"y":600}},
    {"id":"s07","type":"logic.stop","label":"Nenhum post novo","config":{},"position":{"x":500,"y":750}},
    {"id":"s19","type":"meta.filter_eligible_posts","label":"Filtrar posts elegíveis para boost","config":{},"position":{"x":100,"y":750}},
    {"id":"s17","type":"logic.if","label":"Tem posts inelegíveis?","config":{"value":"1","operator":">=","variable":"total_inelegiveis"},"position":{"x":100,"y":900}},
    {"id":"s20","type":"logic.loop","label":"Loop posts inelegíveis","config":{"list":"{{posts_inelegiveis}}"},"position":{"x":100,"y":1050}},
    {"id":"s21","type":"whatsapp.send_message","label":"Avisar post inelegível","config":{"message":"⚠️ *Post inelegível para boost — {{cliente.nome}}*\n\n📸 Post: {{item.id}}\n❌ Motivo: {{item.motivo}}\n\nAcesse o Meta Business Suite e suba este post manualmente como anúncio."},"position":{"x":100,"y":1200}},
    {"id":"s08","type":"logic.loop","label":"Loop posts elegíveis","config":{"list":"{{posts}}"},"position":{"x":100,"y":1350}},
    {"id":"s09","type":"logic.switch","label":"Verificar palavra-chave","config":{"variable":"{{item.caption}}","cases":[{"id":"case_a","label":"Caso 1","value":"palavra1"},{"id":"case_b","label":"Caso 2","value":"palavra2"}]},"position":{"x":100,"y":1500}},
    {"id":"s10","type":"meta.create_ad","label":"Criar anúncio Caso 1","config":{"creative_type":"instagram_post","source_instagram_media_id":"{{item.id}}","adset_id":"","campaign_id":"","name":"Post {{item.id}} - Caso 1"},"position":{"x":-200,"y":1660}},
    {"id":"s11","type":"meta.create_ad","label":"Criar anúncio Caso 2","config":{"creative_type":"instagram_post","source_instagram_media_id":"{{item.id}}","adset_id":"","campaign_id":"","name":"Post {{item.id}} - Caso 2"},"position":{"x":100,"y":1660}},
    {"id":"s12","type":"meta.create_ad","label":"Criar anúncio Padrão","config":{"creative_type":"instagram_post","source_instagram_media_id":"{{item.id}}","adset_id":"","campaign_id":"","name":"Post {{item.id}} - Padrão"},"position":{"x":400,"y":1660}},
    {"id":"s13","type":"logic.if","label":"Anúncio criado?","config":{"operator":"not_empty","variable":"ad_id"},"position":{"x":100,"y":1820}},
    {"id":"s14","type":"whatsapp.send_message","label":"Notificar erro","config":{"message":"❌ *Falha ao criar anúncio {{cliente.nome}}*\n\n🔗 Post: {{post_permalink}}\n📝 Legenda: {{post_caption}}\n📸 Tipo: {{post_media_type}}\n\n⚠️ Motivo: {{motivo}}\n🛠️ Erro técnico: {{erro_meta}}\n\n▶️ Acesse o post para subir manualmente."},"position":{"x":350,"y":1980}},
    {"id":"s16","type":"whatsapp.send_message","label":"Notificar sucesso","config":{"message":"✅ *Anúncio criado — {{cliente.nome}}*\n\n🔗 {{post_permalink}}\n📝 {{post_caption}}"},"position":{"x":-150,"y":1980}},
    {"id":"s15","type":"whatsapp.send_message","label":"Loop concluído","config":{"message":"✅ *Loop de anúncios — {{cliente.nome}}*\n\n📊 Posts processados: {{loop_total}}"},"position":{"x":650,"y":1350}}
  ]'::jsonb,
  edges = '[
    {"id":"se01","source":"s01","target":"s02","sourceHandle":"default","targetHandle":"default"},
    {"id":"se02","source":"s02","target":"s03","sourceHandle":"default","targetHandle":"default"},
    {"id":"se03","source":"s03","target":"s04","sourceHandle":"yes","targetHandle":"default"},
    {"id":"se04","source":"s03","target":"s05","sourceHandle":"no","targetHandle":"default"},
    {"id":"se05","source":"s04","target":"s06","sourceHandle":"default","targetHandle":"default"},
    {"id":"se06","source":"s06","target":"s19","sourceHandle":"yes","targetHandle":"default"},
    {"id":"se07","source":"s06","target":"s07","sourceHandle":"no","targetHandle":"default"},
    {"id":"se19a","source":"s19","target":"s17","sourceHandle":"default","targetHandle":"default"},
    {"id":"se17a","source":"s17","target":"s20","sourceHandle":"yes","targetHandle":"default"},
    {"id":"se17b","source":"s17","target":"s08","sourceHandle":"no","targetHandle":"default"},
    {"id":"se20a","source":"s20","target":"s21","sourceHandle":"each","targetHandle":"default"},
    {"id":"se20b","source":"s20","target":"s08","sourceHandle":"done","targetHandle":"default"},
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
  ]'::jsonb
WHERE id = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
