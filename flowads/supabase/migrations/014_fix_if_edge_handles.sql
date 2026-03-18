-- Fix preset edges that use 'true'/'false' sourceHandle instead of 'yes'/'no'
-- These duplicate edges cause both IF branches to execute simultaneously

-- Fix preset 'Sincronizar Posts Instagram' (a1b2c3d4-...)
UPDATE presets
SET edges = (
  SELECT jsonb_agg(
    CASE
      WHEN edge->>'sourceHandle' = 'false' THEN edge || '{"sourceHandle":"no"}'
      WHEN edge->>'sourceHandle' = 'true'  THEN edge || '{"sourceHandle":"yes"}'
      ELSE edge
    END
  )
  FROM jsonb_array_elements(edges) AS edge
  -- Remove the duplicate 'false' edges (keep only 'no' edges)
  WHERE NOT (
    edge->>'sourceHandle' = 'false' AND
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(edges) AS e2
      WHERE e2->>'source' = edge->>'source'
        AND e2->>'target' = edge->>'target'
        AND e2->>'sourceHandle' = 'no'
    )
  )
)
WHERE jsonb_typeof(edges) = 'array'
  AND edges @> '[{"sourceHandle":"false"}]'::jsonb;

-- Also fix any automation_edges rows saved with 'true'/'false' handles
UPDATE automation_edges SET source_handle = 'no'  WHERE source_handle = 'false';
UPDATE automation_edges SET source_handle = 'yes' WHERE source_handle = 'true';
