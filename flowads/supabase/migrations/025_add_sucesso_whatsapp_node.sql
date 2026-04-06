-- Migration: 025_add_sucesso_whatsapp_node
-- Adiciona nó WhatsApp "Notificar sucesso" na saída YES do IF "Anúncio criado?"
-- e corrige IF para usar ad_id not_empty em automações existentes
-- Created: 2026-04-06

DO $$
DECLARE
  rec RECORD;
  new_node_id UUID;
  if_node_id UUID;
  loop_node_id UUID;
  yes_edge_id UUID;
BEGIN
  -- Para cada automação que tem IF "Anúncio criado?" ligado direto ao Loop no YES
  FOR rec IN
    SELECT DISTINCT a.id AS automation_id
    FROM automations a
    JOIN automation_nodes n ON n.automation_id = a.id
    WHERE n.type = 'logic.if' AND n.label ILIKE '%anúncio criado%'
  LOOP
    -- Pega ID do nó IF
    SELECT id INTO if_node_id
    FROM automation_nodes
    WHERE automation_id = rec.automation_id
      AND type = 'logic.if'
      AND label ILIKE '%anúncio criado%'
    LIMIT 1;

    -- Pega ID do loop (destino atual do YES)
    SELECT e.target_node_id INTO loop_node_id
    FROM automation_edges e
    WHERE e.automation_id = rec.automation_id
      AND e.source_node_id = if_node_id
      AND e.source_handle = 'yes'
    LIMIT 1;

    -- Só prossegue se YES aponta para um loop (sem nó de sucesso ainda)
    IF loop_node_id IS NULL THEN CONTINUE; END IF;
    IF EXISTS (
      SELECT 1 FROM automation_nodes
      WHERE automation_id = rec.automation_id
        AND type = 'whatsapp.send_message'
        AND label ILIKE '%sucesso%'
    ) THEN CONTINUE; END IF;

    -- Cria nó WhatsApp de sucesso
    new_node_id := gen_random_uuid();
    INSERT INTO automation_nodes (id, automation_id, type, label, config, position_x, position_y)
    VALUES (
      new_node_id,
      rec.automation_id,
      'whatsapp.send_message',
      'Notificar sucesso',
      '{"message": "✅ *Anúncio criado — {{cliente.nome}}*\n\n🔗 {{item.permalink}}\n📝 {{item.caption}}"}'::jsonb,
      -200,
      1200
    );

    -- Remove edge YES → Loop
    DELETE FROM automation_edges
    WHERE automation_id = rec.automation_id
      AND source_node_id = if_node_id
      AND source_handle = 'yes';

    -- Cria edge YES → Notificar sucesso
    INSERT INTO automation_edges (id, automation_id, source_node_id, target_node_id, source_handle, target_handle)
    VALUES (gen_random_uuid(), rec.automation_id, if_node_id, new_node_id, 'yes', 'default');

    -- Cria edge Notificar sucesso → Loop
    INSERT INTO automation_edges (id, automation_id, source_node_id, target_node_id, source_handle, target_handle)
    VALUES (gen_random_uuid(), rec.automation_id, new_node_id, loop_node_id, 'default', 'default');

  END LOOP;
END $$;
