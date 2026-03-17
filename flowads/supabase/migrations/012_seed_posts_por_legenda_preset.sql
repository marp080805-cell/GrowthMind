-- Seed: Template "Sincronizar Posts por Palavra-chave"
-- Variação do template base: roteia cada post para campanha/conjunto diferente
-- dependendo de uma palavra-chave na legenda (caption) do post.
-- Dentro do bloco IF "Legenda contém?", configure:
--   variável: {{item.caption}}  |  operador: contém  |  valor: sua-palavra-chave

INSERT INTO presets (id, name, description, icon, tags, nodes, edges, is_system)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'Sincronizar Posts por Palavra-chave',
  'Busca posts do Instagram e roteia cada um para campanhas diferentes com base em palavras-chave da legenda. Ex: posts com "almoço" vão para uma campanha específica, os demais para a campanha padrão.',
  '🏷️',
  '["instagram", "meta", "anúncios", "palavra-chave", "legenda"]'::jsonb,
  '[
    {"id":"a1000001-0000-0000-0000-000000000001","type":"trigger.schedule","label":"Todo dia às 10h","config":{"time":"10:00","frequency":"daily"},"position":{"x":260,"y":0}},
    {"id":"a1000001-0000-0000-0000-000000000002","type":"meta.fetch_instagram_posts","label":"Buscar posts recentes","config":{"limit":10,"period":"7d","date_to":"","date_from":"","media_type":"FEED"},"position":{"x":260,"y":182}},
    {"id":"a1000001-0000-0000-0000-000000000003","type":"logic.if","label":"Tem posts?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":260,"y":350}},
    {"id":"a1000001-0000-0000-0000-000000000004","type":"logic.stop","label":"Nenhum post encontrado","config":{},"position":{"x":460,"y":500}},
    {"id":"a1000001-0000-0000-0000-000000000005","type":"meta.filter_unsponsored_posts","label":"Filtrar posts não patrocinados","config":{"source_posts":"{{posts}}"},"position":{"x":60,"y":500}},
    {"id":"a1000001-0000-0000-0000-000000000006","type":"logic.if","label":"Tem posts novos?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":60,"y":680}},
    {"id":"a1000001-0000-0000-0000-000000000007","type":"logic.stop","label":"Nenhum post novo","config":{},"position":{"x":260,"y":830}},
    {"id":"a1000001-0000-0000-0000-000000000008","type":"logic.loop","label":"Loop cada post","config":{"max_iterations":1},"position":{"x":-140,"y":830}},
    {"id":"a1000001-0000-0000-0000-000000000009","type":"logic.if","label":"Legenda contém palavra-chave?","config":{"variable":"{{item.caption}}","operator":"contains","value":"palavra-chave"},"position":{"x":-140,"y":1010}},
    {"id":"a1000001-0000-0000-0000-000000000010","type":"meta.create_ad","label":"Criar anúncio (campanha específica)","config":{"adset_id":"","campaign_id":"","creative_type":"instagram_post"},"position":{"x":-360,"y":1200}},
    {"id":"a1000001-0000-0000-0000-000000000011","type":"meta.create_ad","label":"Criar anúncio (campanha padrão)","config":{"adset_id":"","campaign_id":"","creative_type":"instagram_post"},"position":{"x":80,"y":1200}}
  ]'::jsonb,
  '[
    {"id":"e1000001-0000-0000-0000-000000000001","source":"a1000001-0000-0000-0000-000000000001","target":"a1000001-0000-0000-0000-000000000002","sourceHandle":"default","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000002","source":"a1000001-0000-0000-0000-000000000002","target":"a1000001-0000-0000-0000-000000000003","sourceHandle":"default","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000003","source":"a1000001-0000-0000-0000-000000000003","target":"a1000001-0000-0000-0000-000000000004","sourceHandle":"no","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000004","source":"a1000001-0000-0000-0000-000000000003","target":"a1000001-0000-0000-0000-000000000004","sourceHandle":"false","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000005","source":"a1000001-0000-0000-0000-000000000003","target":"a1000001-0000-0000-0000-000000000005","sourceHandle":"yes","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000006","source":"a1000001-0000-0000-0000-000000000005","target":"a1000001-0000-0000-0000-000000000006","sourceHandle":"default","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000007","source":"a1000001-0000-0000-0000-000000000006","target":"a1000001-0000-0000-0000-000000000007","sourceHandle":"no","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000008","source":"a1000001-0000-0000-0000-000000000006","target":"a1000001-0000-0000-0000-000000000007","sourceHandle":"false","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000009","source":"a1000001-0000-0000-0000-000000000006","target":"a1000001-0000-0000-0000-000000000008","sourceHandle":"yes","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000010","source":"a1000001-0000-0000-0000-000000000008","target":"a1000001-0000-0000-0000-000000000009","sourceHandle":"each","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000011","source":"a1000001-0000-0000-0000-000000000009","target":"a1000001-0000-0000-0000-000000000010","sourceHandle":"yes","targetHandle":"default"},
    {"id":"e1000001-0000-0000-0000-000000000012","source":"a1000001-0000-0000-0000-000000000009","target":"a1000001-0000-0000-0000-000000000011","sourceHandle":"no","targetHandle":"default"}
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;
