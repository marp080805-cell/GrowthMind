# Executor — Bugs e Comportamentos dos Nodes

## Switch node — variável não resolvida pelo nome

**Problema:** Switch com `variable: "acao"` comparava a string literal `"acao"` contra os valores dos cases em vez de buscar `input.acao`.

**Causa:** O executor fazia `const actual = String(variable ?? input ?? '')` sem verificar se `variable` é uma chave no input record.

**Solução:** Igual ao IF node — se `variable` for uma chave existente no input record, usa `inputRecord[variable]`. Caso contrário usa o valor direto (para quando já vem interpolado via `{{acao}}`).

**Como configurar o Switch corretamente:**
- Campo `variable`: usar o nome da chave sem `{{ }}` → ex: `acao`
- Cases: valor exato ou substring do que será comparado → ex: `pausar`, `alertar`
- O match é case-insensitive e usa `includes()` (substring)

---

## IF node — como a variável é resolvida

O IF node já faz a resolução correta:
1. Se `variable` é chave no `inputRecord` → usa `inputRecord[variable]`
2. Caso contrário → usa o valor interpolado diretamente

**Como configurar:**
- Sempre usar o nome da chave sem `{{ }}` → ex: `total`, `ad_id`
- O executor resolve o valor automaticamente do input

---

## Switch — "Pulado (branch inativo)"

Se o node após o Switch aparece como "Pulado (branch inativo)" mesmo com o input chegando corretamente, verificar:

1. O `variable` do Switch está como nome de chave simples (sem `{{ }}`)
2. O `value` do case está em minúsculas (o match é lowercase)
3. A edge saindo do Switch tem o `sourceHandle` igual ao `id` do case (não ao `label`)

### Causa mais comum: edges desenhadas antes de configurar os casos

**Problema:** Se o usuário desenhou as edges saindo do Switch antes de configurar os cases, essas edges ficam com `sourceHandle: 'default'` (handle "Padrão" — único disponível quando não há cases). Depois de configurar os cases, as edges continuam com `sourceHandle: 'default'`, mas o executor espera `sourceHandle: 'case_abc123'`. O executor trata 'default' como inactive quando um case específico foi matched → o node seguinte aparece como "Pulado".

**Solução:** Recriar as edges após configurar os cases.
- Delete todas as edges saindo do Switch
- Reconecte a partir dos handles corretos (cada case tem seu handle próprio)

**Fix automático (canvas.tsx):** Quando cases são configurados pela primeira vez (0 → N cases), o canvas remove automaticamente as edges com `sourceHandle: 'default'`, forçando o usuário a reconectar do handle correto.

---

## Variáveis disponíveis por node

### evaluate_campaign_performance (Avaliar campanha)

Saída no modo single-ad (dentro de loop):

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `acao` | string | `"pausar"` / `"alertar"` / `"manter"` |
| `pausar` | boolean | true se deve pausar |
| `alertar` | boolean | true se deve alertar |
| `manter` | boolean | true se deve manter |
| `score` | number | 0–100 |
| `motivo` | string | Explicação da decisão |
| `motivo_alerta` | string | Motivo quando alertar |
| `age_days` | number | Idade do anúncio em dias |
| `skip_evaluation` | boolean | true se ainda em maturação |
| `id` | string | ID do anúncio (usar no Pausar como `{{id}}`) |
| `nome` | string | Nome do anúncio |
| `metricas` | object | Métricas completas do anúncio |

### fetch_metrics com breakdown: ad

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `anuncios_metricas` | array | Lista de anúncios com métricas |
| `total` | number | Quantidade de anúncios |

### pause_ad (Pausar)

| Variável | Configuração |
|----------|-------------|
| `ad_id` | `{{id}}` — ID do anúncio vindo do Avaliar campanha |
