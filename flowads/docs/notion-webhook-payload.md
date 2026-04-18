# Notion Webhook — Estrutura do Payload e Caminhos de Variáveis

## Contexto

Quando o Notion dispara um webhook (via automação interna do Notion), o payload recebido é uma página completa da API do Notion. O trigger `trigger.webhook` passa o body inteiro como saída, acessível via `{{data.*}}`.

## Estrutura do payload

```json
{
  "data": {
    "id": "32929e11-1d88-806e-8efe-c2c8bd09fea5",
    "url": "https://www.notion.so/teste-nome-...",
    "object": "page",
    "parent": {
      "type": "data_source_id",
      "database_id": "32929e11-1d88-8035-bf93-d0896a306292",
      "data_source_id": "32929e11-1d88-8047-8863-000bae8e8895"
    },
    "in_trash": false,
    "is_locked": false,
    "created_by": { "id": "...", "object": "user" },
    "properties": {
      "Nome":           { "type": "title",     "title": [{ "plain_text": "teste nome", "text": { "content": "teste nome" } }] },
      "Ad ID":          { "type": "rich_text", "rich_text": [] },
      "Status":         { "type": "status",    "status": { "name": "Pendente", "color": "default" } },
      "Título":         { "type": "rich_text", "rich_text": [{ "plain_text": "teste título", "text": { "content": "teste título" } }] },
      "Criativo":       { "type": "url",       "url": "https://drive.google.com/file/d/..." },
      "Publicar":       { "type": "checkbox",  "checkbox": true },
      "Publicado em":   { "type": "date",      "date": { "start": "2026-04-18" } },
      "Texto principal":{ "type": "rich_text", "rich_text": [{ "plain_text": "Texto do anúncio" }] }
    }
  },
  "source": {
    "type": "automation",
    "action_id": "...",
    "automation_id": "..."
  }
}
```

## Caminhos para usar nos nodes

| Campo Notion       | Tipo Notion | Variável no node                                                  |
|--------------------|-------------|-------------------------------------------------------------------|
| Nome               | title       | `{{data.properties.Nome.title[0].plain_text}}`                   |
| Título             | rich_text   | `{{data.properties.Título.rich_text[0].plain_text}}`             |
| Texto principal    | rich_text   | `{{data.properties.Texto principal.rich_text[0].plain_text}}`    |
| Criativo (url)     | url         | `{{data.properties.Criativo.url}}`  ← tipo URL direto            |
| Criativo (files)   | files       | `{{data.properties.Criativo.files[0].external.url}}` ou `.file.url` |
| Status             | status      | `{{data.properties.Status.status.name}}`                         |
| Ad ID              | rich_text   | `{{data.properties.Ad ID.rich_text[0].plain_text}}`              |
| Publicado em       | date        | `{{data.properties.Publicado em.date.start}}`                    |
| ID da página       | —           | `{{data.id}}`                                                     |

> **Atenção:** o tipo da propriedade no Notion determina o caminho. Propriedade do tipo `url` tem o link em `.url` direto. Propriedade do tipo `files` tem o link em `.files[0].external.url` (link externo) ou `.files[0].file.url` (arquivo no Notion).

## Bug corrigido — interpolação com `key[n]`

O interpolador de variáveis divide por `.` e processava `files[0]` como chave literal (não como array access), retornando string vazia.

**Correção (executor.ts `interpolate`):** adicionado suporte a `key[n]` via regex `([^\[]+)\[(\d+)\]` — agora `files[0]` funciona igual a `files.[0]`.

Ambas as sintaxes são válidas:
- `{{data.properties.Criativo.files[0].external.url}}` ✓
- `{{data.properties.Criativo.files.[0].external.url}}` ✓
