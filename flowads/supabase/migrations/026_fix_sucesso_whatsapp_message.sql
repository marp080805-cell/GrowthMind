-- Migration: 026_fix_sucesso_whatsapp_message
-- Corrige mensagem do nó "Notificar sucesso" para usar post_permalink/post_caption
-- em vez de item.permalink/item.caption (variáveis que não resolvem corretamente)
-- Created: 2026-04-06

UPDATE automation_nodes
SET config = jsonb_set(
  config,
  '{message}',
  '"✅ *Anúncio criado — {{cliente.nome}}*\n\n🔗 {{post_permalink}}\n📝 {{post_caption}}"'
)
WHERE type = 'whatsapp.send_message'
  AND label ILIKE '%sucesso%'
  AND config->>'message' LIKE '%item.permalink%';
