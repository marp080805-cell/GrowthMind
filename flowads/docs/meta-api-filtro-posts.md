# Meta API — Filtro de Posts e Detecção de Duplicatas

## Fluxo de filtro no sistema (filter_unsponsored_posts)

### Passo 1 — Filtrar posts já patrocinados

Consulta todos os anúncios ativos da conta e coleta os IDs dos posts já usados:

```
GET /act_{ad-account-id}/ads
  ?fields=creative{source_instagram_media_id,effective_instagram_media_id}
  &filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED","PENDING_REVIEW","CAMPAIGN_PAUSED","ADSET_PAUSED"]}]
  &limit=500
```

Dois campos consultados para cobrir ambos os paths de criação:
- `source_instagram_media_id` — boost direto via Path 1
- `effective_instagram_media_id` — preenchido automaticamente pela Meta em qualquer path

### Passo 2 — Filtrar posts inelegíveis via boost_eligibility_info

O campo `boost_eligibility_info` já vem no `fetch_instagram_posts` — sem chamada extra à API.

```typescript
if (boostInfo && boostInfo.eligible_to_boost === false) {
  // descarta o post antes do loop
}
```

**Razões de inelegibilidade conhecidas:**

| Reason code | Significado |
|-------------|-------------|
| `COPYRIGHT` / `MUSIC` | Música protegida por direitos autorais |
| `COLLAB` / `COLLABORATION` | Post em colaboração (collab) |
| `TEMPLATE` | Reel criado a partir de template |
| `FILTER` / `EFFECT` | Efeito/filtro restrito |
| `REMIX` | Reel remixado |
| `INTERACTIVE` | Elemento interativo |

## Propagação da Meta API

Anúncios recém-criados podem não aparecer imediatamente na listagem de ads.
O sistema usa `effective_instagram_media_id` para minimizar esse problema — esse campo é preenchido pela Meta em qualquer path de criação.

## Campos do fetch_instagram_posts

```
fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,
         permalink,timestamp,like_count,comments_count,boost_eligibility_info'
```
