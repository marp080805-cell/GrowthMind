-- Migration: 027_update_sucesso_message_via_boost
-- Atualiza mensagem "Notificar sucesso" para incluir tipo_anuncio
-- O executor resolve {{tipo_anuncio}} como:
--   "📌 Post original turbinado" quando via_boost=true
--   "⚠️ Anúncio independente (post tem música licenciada)"  quando via_boost=false
-- Created: 2026-04-07

UPDATE automation_nodes
SET config = jsonb_set(
  config,
  '{message}',
  '"✅ *Anúncio criado — {{cliente.nome}}*\n\n🔗 {{post_permalink}}\n📝 {{post_caption}}\n\n{{tipo_anuncio}}"'
)
WHERE type = 'whatsapp.send_message'
  AND label ILIKE '%sucesso%'
  AND config->>'message' LIKE '%post_permalink%';
