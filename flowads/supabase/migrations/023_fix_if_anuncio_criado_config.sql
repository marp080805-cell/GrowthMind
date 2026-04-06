-- Migration: 023_fix_if_anuncio_criado_config
-- Corrige o nó IF "Anúncio criado?" em todas as automações para usar
-- ad_id not_empty em vez de success = true (comparação booleana era instável)
-- Created: 2026-04-06

UPDATE automation_nodes
SET config = jsonb_set(
  jsonb_set(config, '{variable}', '"ad_id"'),
  '{operator}', '"not_empty"'
) - 'value'
WHERE type = 'logic.if'
  AND label ILIKE '%anúncio criado%'
  AND config->>'variable' = 'success';
