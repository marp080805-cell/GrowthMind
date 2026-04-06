-- Migration: 017_seed_instagram_loop_ads_preset
-- Description: Template "Criar anúncios com posts do Instagram" com loop, IF sucesso e notificação WhatsApp
-- Created: 2026-04-02

INSERT INTO presets (id, name, description, icon, tags, nodes, edges, is_system)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'Criar anúncios com posts do Instagram',
  'Busca posts recentes do Instagram, filtra os não patrocinados, e para cada post cria um anúncio. Notifica por WhatsApp em caso de erro por post e envia resumo ao concluir o loop.',
  '🔁',
  '["instagram", "meta", "anúncios", "loop", "whatsapp"]'::jsonb,
  '[
    {"id":"n01","type":"trigger.schedule","label":"Agendamento","config":{"time":"19:00"},"position":{"x":400,"y":0}},
    {"id":"n02","type":"meta.fetch_instagram_posts","label":"Buscar posts Instagram","config":{},"position":{"x":400,"y":150}},
    {"id":"n03","type":"logic.if","label":"Tem posts?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":400,"y":300}},
    {"id":"n04","type":"meta.filter_unsponsored_posts","label":"Filtrar posts não patrocinados","config":{"source_posts":"{{posts}}"},"position":{"x":230,"y":450}},
    {"id":"n05","type":"logic.stop","label":"Nenhum post encontrado","config":{},"position":{"x":580,"y":450}},
    {"id":"n06","type":"logic.if","label":"Tem posts novos?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":230,"y":600}},
    {"id":"n07","type":"logic.stop","label":"Nenhum post novo","config":{},"position":{"x":450,"y":750}},
    {"id":"n08","type":"logic.loop","label":"Loop","config":{"list":"{{posts}}"},"position":{"x":80,"y":750}},
    {"id":"n09","type":"meta.create_ad","label":"Criar anúncio","config":{"creative_type":"instagram_post","source_instagram_media_id":"{{item.id}}","adset_id":"","campaign_id":"","name":"Post Instagram {{item.id}}"},"position":{"x":80,"y":900}},
    {"id":"n10","type":"logic.if","label":"Anúncio criado?","config":{"operator":"not_empty","variable":"ad_id"},"position":{"x":80,"y":1050}},
    {"id":"n11","type":"whatsapp.send_message","label":"Notificar erro","config":{"message":"❌ *Falha ao criar anúncio {{cliente.nome}}*\n\n🔗 Post: {{post_permalink}}\n📝 Legenda: {{post_caption}}\n📸 Tipo: {{post_media_type}}\n\n⚠️ Motivo: {{motivo}}\n🛠️ Erro técnico: {{erro_meta}}\n\n▶️ Acesse o post para subir manualmente."},"position":{"x":300,"y":1200}},
    {"id":"n13","type":"whatsapp.send_message","label":"Notificar sucesso","config":{"message":"✅ *Anúncio criado — {{cliente.nome}}*\n\n🔗 {{item.permalink}}\n📝 {{item.caption}}"},"position":{"x":-150,"y":1200}},
    {"id":"n12","type":"whatsapp.send_message","label":"Loop concluído","config":{"message":"✅ *Loop de anúncios — {{cliente.nome}}*\n\n📊 Posts processados: {{loop_total}}"},"position":{"x":580,"y":900}}
  ]'::jsonb,
  '[
    {"id":"e01","source":"n01","target":"n02","sourceHandle":"default","targetHandle":"default"},
    {"id":"e02","source":"n02","target":"n03","sourceHandle":"default","targetHandle":"default"},
    {"id":"e03","source":"n03","target":"n04","sourceHandle":"yes","targetHandle":"default"},
    {"id":"e04","source":"n03","target":"n05","sourceHandle":"no","targetHandle":"default"},
    {"id":"e05","source":"n04","target":"n06","sourceHandle":"default","targetHandle":"default"},
    {"id":"e06","source":"n06","target":"n08","sourceHandle":"yes","targetHandle":"default"},
    {"id":"e07","source":"n06","target":"n07","sourceHandle":"no","targetHandle":"default"},
    {"id":"e08","source":"n08","target":"n09","sourceHandle":"each","targetHandle":"default"},
    {"id":"e09","source":"n09","target":"n10","sourceHandle":"default","targetHandle":"default"},
    {"id":"e10","source":"n10","target":"n11","sourceHandle":"no","targetHandle":"default"},
    {"id":"e11","source":"n10","target":"n13","sourceHandle":"yes","targetHandle":"default"},
    {"id":"e12","source":"n11","target":"n08","sourceHandle":"default","targetHandle":"default"},
    {"id":"e14","source":"n13","target":"n08","sourceHandle":"default","targetHandle":"default"},
    {"id":"e13","source":"n08","target":"n12","sourceHandle":"done","targetHandle":"default"}
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;
