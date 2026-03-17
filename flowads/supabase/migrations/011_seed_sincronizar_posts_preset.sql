-- Seed: Template "Sincronizar Posts Instagram" (baseado na automação real do Tmax)
-- Campos específicos do cliente (adset_id, campaign_id) foram limpos para uso genérico

INSERT INTO presets (id, name, description, icon, tags, nodes, edges, is_system)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Sincronizar Posts Instagram',
  'Busca posts recentes do Instagram, filtra os não patrocinados e cria anúncios automaticamente para cada post novo.',
  '📸',
  '["instagram", "meta", "anúncios", "automático"]'::jsonb,
  '[
    {"id":"00bc97c9-2033-4bed-b48e-a5b783f2c505","type":"trigger.schedule","label":"Todo dia às 10h","config":{"time":"10:00","frequency":"daily"},"position":{"x":260,"y":0}},
    {"id":"88257e77-1f9f-442d-8be4-d26ed707a26a","type":"meta.fetch_instagram_posts","label":"Buscar posts recentes","config":{"limit":10,"period":"7d","date_to":"","date_from":"","media_type":"FEED"},"position":{"x":266,"y":182}},
    {"id":"5787800e-651e-4aae-becf-b96086d96e74","type":"logic.if","label":"Tem posts?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":238,"y":350}},
    {"id":"93d2ad3e-089d-4b6c-8356-956cbec3a5aa","type":"meta.filter_unsponsored_posts","label":"Filtrar posts não patrocinados","config":{"source_posts":"{{posts}}"},"position":{"x":112,"y":504}},
    {"id":"3fdeb7a8-ce1c-42d6-8e49-7a49b0005632","type":"logic.stop","label":"Nenhum post encontrado","config":{},"position":{"x":392,"y":532}},
    {"id":"2aa79a37-7153-4c68-b633-63eb99e7048d","type":"logic.if","label":"Tem posts novos?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":112,"y":700}},
    {"id":"80a60dcc-e435-4918-8356-53febbc55193","type":"logic.loop","label":"Loop","config":{"max_iterations":1},"position":{"x":-14,"y":882}},
    {"id":"2521d1ce-1048-450c-99c0-746c604ed048","type":"logic.stop","label":"Nenhum post novo","config":{},"position":{"x":266,"y":896}},
    {"id":"fb21cac2-dc92-4691-94b3-815e70eb326c","type":"meta.create_ad","label":"Criar anúncio","config":{"adset_id":"","campaign_id":"","creative_type":"instagram_post"},"position":{"x":-336,"y":1022}}
  ]'::jsonb,
  '[
    {"id":"261a7d86-2bda-4f44-bb63-6a8527a624a3","source":"00bc97c9-2033-4bed-b48e-a5b783f2c505","target":"88257e77-1f9f-442d-8be4-d26ed707a26a","sourceHandle":"default","targetHandle":"default"},
    {"id":"25c928d9-2903-4e64-95ab-3d6ec67a29b2","source":"88257e77-1f9f-442d-8be4-d26ed707a26a","target":"5787800e-651e-4aae-becf-b96086d96e74","sourceHandle":"default","targetHandle":"default"},
    {"id":"3b17a36f-af41-46dc-88e1-f16eed5fe196","source":"5787800e-651e-4aae-becf-b96086d96e74","target":"93d2ad3e-089d-4b6c-8356-956cbec3a5aa","sourceHandle":"yes","targetHandle":"default"},
    {"id":"0c7dfae1-9167-41f1-9366-55f24cd0ceb6","source":"5787800e-651e-4aae-becf-b96086d96e74","target":"3fdeb7a8-ce1c-42d6-8e49-7a49b0005632","sourceHandle":"no","targetHandle":"default"},
    {"id":"f4e42b3c-3463-44ab-a0f6-efe9a301dbf5","source":"5787800e-651e-4aae-becf-b96086d96e74","target":"3fdeb7a8-ce1c-42d6-8e49-7a49b0005632","sourceHandle":"false","targetHandle":"default"},
    {"id":"1582ce00-d650-49da-b5c4-c1e024c6c10e","source":"93d2ad3e-089d-4b6c-8356-956cbec3a5aa","target":"2aa79a37-7153-4c68-b633-63eb99e7048d","sourceHandle":"default","targetHandle":"default"},
    {"id":"dc90bb8b-38be-4593-b585-ab8957629b16","source":"2aa79a37-7153-4c68-b633-63eb99e7048d","target":"80a60dcc-e435-4918-8356-53febbc55193","sourceHandle":"yes","targetHandle":"default"},
    {"id":"f3aacc56-6d4d-450c-bf01-9e36fe7c538d","source":"2aa79a37-7153-4c68-b633-63eb99e7048d","target":"2521d1ce-1048-450c-99c0-746c604ed048","sourceHandle":"false","targetHandle":"default"},
    {"id":"eb3543b5-37d7-44ba-837b-6b73d217bb1e","source":"2aa79a37-7153-4c68-b633-63eb99e7048d","target":"2521d1ce-1048-450c-99c0-746c604ed048","sourceHandle":"no","targetHandle":"default"},
    {"id":"6063357e-4c4e-4688-b79a-2e2fd50df6ac","source":"80a60dcc-e435-4918-8356-53febbc55193","target":"fb21cac2-dc92-4691-94b3-815e70eb326c","sourceHandle":"each","targetHandle":"default"},
    {"id":"76b1ca2c-1642-4b25-afa8-8d72a11571c7","source":"fb21cac2-dc92-4691-94b3-815e70eb326c","target":"80a60dcc-e435-4918-8356-53febbc55193","sourceHandle":"default","targetHandle":"default"}
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;
