-- Migration: 019_seed_pausar_anuncios_preset
-- Description: Template "Pausar anúncios por performance" — busca métricas (30d), avalia scoring, pausa ou alerta via WhatsApp
-- Created: 2026-04-02

INSERT INTO presets (id, name, description, icon, tags, nodes, edges, is_system)
VALUES (
  'd4e5f6a7-b8c9-0123-defa-234567890123',
  'Pausar anúncios por performance',
  'Busca todos os anúncios ativos com métricas dos últimos 30 dias, avalia o scoring de cada um e pausa automaticamente os que estão abaixo do threshold. Envia alerta por WhatsApp quando pausa um anúncio e quando o score está em risco mas o mínimo de ativos protege a pausa.',
  '⏸️',
  '["meta", "anúncios", "performance", "scoring", "pausar", "loop", "whatsapp"]'::jsonb,
  '[
    {"id":"d01","type":"trigger.schedule","label":"Agendamento","config":{"time":"20:00"},"position":{"x":400,"y":0}},
    {"id":"d02","type":"meta.get_ad_metrics","label":"Buscar métricas","config":{"period":"30d","source":"fetch"},"position":{"x":400,"y":150}},
    {"id":"d03","type":"logic.if","label":"Tem anúncios ativos?","config":{"value":"1","operator":">=","variable":"total"},"position":{"x":400,"y":300}},
    {"id":"d04","type":"logic.stop","label":"Nenhum anúncio ativo","config":{},"position":{"x":650,"y":450}},
    {"id":"d05","type":"logic.loop","label":"Loop","config":{"list":"{{anuncios}}"},"position":{"x":200,"y":450}},
    {"id":"d06","type":"meta.evaluate_campaign_performance","label":"Avaliar anúncio","config":{},"position":{"x":200,"y":620}},
    {"id":"d07","type":"logic.switch","label":"Ação recomendada","config":{"variable":"{{acao}}","cases":[{"id":"case_pausar","label":"Pausar","value":"pausar"},{"id":"case_alertar","label":"Alerta","value":"alertar"}]},"position":{"x":200,"y":790}},
    {"id":"d08","type":"meta.pause_ad","label":"Pausar anúncio","config":{"ad_id":"{{id}}"},"position":{"x":-80,"y":960}},
    {"id":"d09","type":"whatsapp.send_message","label":"Notificar pausa","config":{"message":"⏸️ *Anúncio pausado — {{cliente.nome}}*\n\n📛 Anúncio: {{nome}}\n🆔 ID: {{id}}\n📊 Score: {{score}}\n📅 Idade: {{age_days}} dias\n💸 Gasto: R$ {{metricas.gasto}}\n🔁 Frequência: {{metricas.frequencia}}\n📈 CTR: {{metricas.ctr}}%\n\n💬 Motivo: {{motivo}}"},"position":{"x":-80,"y":1120}},
    {"id":"d10","type":"whatsapp.send_message","label":"Notificar alerta","config":{"message":"⚠️ *Alerta de anúncio — {{cliente.nome}}*\n\n📛 Anúncio: {{nome}}\n🆔 ID: {{id}}\n📊 Score: {{score}}\n📅 Idade: {{age_days}} dias\n🔁 Frequência: {{metricas.frequencia}}\n📈 CTR: {{metricas.ctr}}%\n\n💬 Motivo: {{motivo}}\n\n▶️ Verifique e tome ação manualmente."},"position":{"x":280,"y":960}},
    {"id":"d11","type":"whatsapp.send_message","label":"Avaliação concluída","config":{"message":"✅ *Avaliação concluída — {{cliente.nome}}*\n\n📊 Anúncios avaliados: {{loop_total}}"},"position":{"x":600,"y":560}}
  ]'::jsonb,
  '[
    {"id":"de01","source":"d01","target":"d02","sourceHandle":"default","targetHandle":"default"},
    {"id":"de02","source":"d02","target":"d03","sourceHandle":"default","targetHandle":"default"},
    {"id":"de03","source":"d03","target":"d05","sourceHandle":"yes","targetHandle":"default"},
    {"id":"de04","source":"d03","target":"d04","sourceHandle":"no","targetHandle":"default"},
    {"id":"de05","source":"d05","target":"d06","sourceHandle":"each","targetHandle":"default"},
    {"id":"de06","source":"d06","target":"d07","sourceHandle":"default","targetHandle":"default"},
    {"id":"de07","source":"d07","target":"d08","sourceHandle":"case_pausar","targetHandle":"default"},
    {"id":"de08","source":"d07","target":"d10","sourceHandle":"case_alertar","targetHandle":"default"},
    {"id":"de09","source":"d07","target":"d05","sourceHandle":"default","targetHandle":"default"},
    {"id":"de10","source":"d08","target":"d09","sourceHandle":"default","targetHandle":"default"},
    {"id":"de11","source":"d09","target":"d05","sourceHandle":"default","targetHandle":"default"},
    {"id":"de12","source":"d10","target":"d05","sourceHandle":"default","targetHandle":"default"},
    {"id":"de13","source":"d05","target":"d11","sourceHandle":"done","targetHandle":"default"}
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;
