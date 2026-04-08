-- Migration: 027_update_sucesso_message_via_boost
-- Garante mensagem padronizada no node "Notificar sucesso"
-- Created: 2026-04-07 | Updated: 2026-04-08

UPDATE automation_nodes
SET config = jsonb_set(
  config,
  '{message}',
  '"✅ *Anúncio criado — {{cliente.nome}}*\n\n🔗 {{post_permalink}}\n📝 {{post_caption}}"'
)
WHERE type = 'whatsapp.send_message'
  AND label ILIKE '%sucesso%'
  AND config->>'message' LIKE '%post_permalink%';
