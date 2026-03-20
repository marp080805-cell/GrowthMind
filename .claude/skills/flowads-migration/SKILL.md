---
name: flowads-migration
description: >
  Cria e aplica migrations de banco de dados no AdMind (Supabase/PostgreSQL). Use esta skill
  sempre que o usuário quiser adicionar coluna, criar tabela, alterar schema, ou quando mencionar
  "migration", "alterar o banco", "nova coluna", "criar tabela", "mudar o schema", "adicionar campo
  no banco" ou qualquer variação. Também deve ser usada quando uma nova feature exige mudanças no
  schema (ex: "quero salvar X" → precisa de coluna para isso).
---

# Migrations do AdMind (Supabase)

## Convenção de nomenclatura

```
supabase/migrations/<NNN>_<descricao_snake_case>.sql
```

- `NNN` = número sequencial com 3 dígitos, seguindo o último arquivo existente
- Descricao em snake_case, curta e descritiva

Exemplos:
```
001_initial_schema.sql
002_rls_policies.sql
003_seed_presets.sql
004_add_instagram_account.sql   ← próxima seria 005_...
```

**Antes de criar**, sempre liste os arquivos existentes para pegar o número correto:
```bash
ls flowads/supabase/migrations/
```

---

## Estrutura de um arquivo de migration

```sql
-- Migration: NNN_descricao
-- Description: O que esta migration faz (1-2 linhas)
-- Created: YYYY-MM-DD

-- ====================
-- UP (aplicar)
-- ====================

ALTER TABLE nome_tabela ADD COLUMN nome_coluna tipo_dado DEFAULT valor;

-- Índice (se necessário para queries frequentes)
CREATE INDEX IF NOT EXISTS idx_tabela_coluna ON nome_tabela(nome_coluna);

-- ====================
-- ROLLBACK (reverter — comentado, para referência)
-- ====================
-- ALTER TABLE nome_tabela DROP COLUMN IF EXISTS nome_coluna;
```

---

## Schema existente (referência rápida)

| Tabela | Colunas principais |
|---|---|
| `users` | id, email, name, role, is_active |
| `clients` | id, user_id, name, business_type, whatsapp, context, ad_account_id, meta_token, status |
| `campaigns` | id, client_id, meta_campaign_id, name, status, objective, budget |
| `automations` | id, client_id, name, description, is_active, last_run_at |
| `automation_nodes` | id, automation_id, type, label, config (jsonb), position_x, position_y |
| `automation_edges` | id, automation_id, source_node_id, target_node_id, source_handle, target_handle |
| `execution_logs` | id, automation_id, status, started_at, finished_at, log_data (jsonb) |
| `agents` | id, client_id, automation_node_id, name, model, system_prompt, memory_enabled |
| `agent_memory` | id, agent_id, client_id, execution_id, role, content |
| `presets` | id, name, description, icon, tags, nodes (jsonb), edges (jsonb), is_system |
| `settings` | id, meta_token, openai_key, anthropic_key, available_models (jsonb) |

Para detalhes completos, leia `flowads/supabase/migrations/001_initial_schema.sql`.

---

## Padrões de SQL do projeto

**Tipos usados:**
- `uuid DEFAULT gen_random_uuid()` para PKs
- `text` para strings (não `varchar`)
- `jsonb` para objetos/arrays estruturados
- `boolean DEFAULT false` para flags
- `timestamptz DEFAULT now()` para timestamps
- `numeric(15,2)` para valores monetários

**Constraints comuns:**
```sql
-- FK com cascade
CONSTRAINT fk_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE

-- Enum via CHECK
CONSTRAINT chk_status CHECK (status IN ('active', 'paused', 'deleted'))

-- Not null com default
nome text NOT NULL DEFAULT ''
```

---

## Como aplicar a migration

O AdMind usa o **Supabase Dashboard** ou `psql` direto — não há CLI de migration automatizada.

### Opção 1 — Supabase Dashboard (recomendado)
1. Acesse o Supabase Dashboard do projeto
2. Vá em **SQL Editor**
3. Cole o conteúdo do arquivo `.sql`
4. Execute e verifique se não há erros

### Opção 2 — psql direto
```bash
psql "$DATABASE_URL" -f flowads/supabase/migrations/<arquivo>.sql
```

### Verificar se aplicou
```sql
-- Checar se coluna existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'nome_tabela';

-- Checar se tabela existe
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

---

## Após criar a migration

Se a mudança adiciona/remove campos que o backend usa, atualize também:

1. **Types TypeScript** em `backend/src/lib/types.ts` ou onde os tipos estão definidos
2. **Queries Supabase** nos routes que usam a tabela alterada
3. **Frontend** se o campo aparece em formulários ou listagens

---

## Migration pendente (contexto)

```
005_add_instagram_account.sql — adiciona coluna instagram_account_id na tabela clients
```
Este arquivo já existe em `flowads/supabase/migrations/005_add_instagram_account.sql` e ainda não foi aplicado no Supabase.
