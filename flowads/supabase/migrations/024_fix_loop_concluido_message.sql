-- Migration: 024_fix_loop_concluido_message
-- Corrige mensagem do WhatsApp "Loop concluído" para não exibir JSON bruto de {{posts}}
-- Created: 2026-04-06

UPDATE automation_nodes
SET config = jsonb_set(
  config,
  '{message}',
  '"✅ *Loop de anúncios — {{cliente.nome}}*\n\n📊 Posts processados: {{loop_total}}"'
)
WHERE type = 'whatsapp.send_message'
  AND label ILIKE '%loop concluído%'
  AND config->>'message' LIKE '%{{posts}}%';
