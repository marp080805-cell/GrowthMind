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
      "Nome":           { "type": "title",     "title": [{ "plain_text": "Nome do anúncio" }] },
      "Ad ID":          { "type": "rich_text", "rich_text": [{ "plain_text": "act_123456" }] },
      "Status":         { "type": "select",    "select": { "name": "Publicar" } },
      "Titulo":         { "type": "title",     "title": [{ "plain_text": "Título do anúncio" }] },
      "Criativo":       { "type": "files",     "files": [{ "type": "external", "external": { "url": "https://drive.google.com/file/d/..." } }] },
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

| Campo Notion       | Variável no node                                                  |
|--------------------|-------------------------------------------------------------------|
| Nome/Título        | `{{data.properties.Titulo.title[0].plain_text}}`                 |
| Texto principal    | `{{data.properties.Texto principal.rich_text[0].plain_text}}`    |
| Criativo (Drive)   | `{{data.properties.Criativo.files[0].external.url}}`             |
| Criativo (Notion)  | `{{data.properties.Criativo.files[0].file.url}}`                 |
| Status (select)    | `{{data.properties.Status.select.name}}`                         |
| Ad ID              | `{{data.properties.Ad ID.rich_text[0].plain_text}}`              |
| Publicado em       | `{{data.properties.Publicado em.date.start}}`                    |
| ID da página       | `{{data.id}}`                                                     |

## Bug corrigido — interpolação com `key[n]`

O interpolador de variáveis divide por `.` e processava `files[0]` como chave literal (não como array access), retornando string vazia.

**Correção (executor.ts `interpolate`):** adicionado suporte a `key[n]` via regex `([^\[]+)\[(\d+)\]` — agora `files[0]` funciona igual a `files.[0]`.

Ambas as sintaxes são válidas:
- `{{data.properties.Criativo.files[0].external.url}}` ✓
- `{{data.properties.Criativo.files.[0].external.url}}` ✓
