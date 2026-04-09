# Meta API — Erros Conhecidos e Classificações

## Erros de Inelegibilidade do Post

| Código | Significado | Comportamento no sistema |
|--------|-------------|--------------------------|
| `2875030` | Reel com música protegida por direitos autorais | Skip — notifica erro |
| `1487470` | Conteúdo não elegível para promoção | Skip — notifica erro |
| `1487760` | Post não pode ser turbinado (violação de política) | Skip — notifica erro |
| `1885006` | Mídia não pode ser promovida | Skip — notifica erro |
| `1885057` | Reel não elegível para anúncios | Skip — notifica erro |
| `2207026` | Reel não elegível para anúncios | Skip — notifica erro |
| `1349152` | Post não pode ser usado como criativo | Skip — notifica erro |

## Erros de Configuração de Campanha

| Código | Significado | Solução |
|--------|-------------|---------|
| `2061015` | Website URL obrigatório no criativo | Campanha de tráfego requer `destination_url` no bloco |
| `2446383` | Objetivo da campanha requer URL de site externo | Idem — ou usar campanha de Engajamento/Reconhecimento |
| `3858615` | CTA type inválido para a meta de desempenho | Verificar CTA type compatível com o objetivo |

## Erros Técnicos de Vídeo

| Código | Significado real | O que NÃO é |
|--------|-----------------|-------------|
| `1815279` | Incompatibilidade técnica de vídeo no fluxo da Meta API | ❌ Não é erro de música ❌ Não é collab ❌ Não é duração |

> **Nota:** O erro 1815279 costumava ser causado pelo envio incorreto de `object_id` (Page ID) junto com `source_instagram_media_id`. Após remover o `object_id` do creative body, esse erro deixou de ocorrer na maioria dos casos.

## Erros Genéricos

| Código | Significado |
|--------|-------------|
| `1346001` | Erro de validação genérico da Meta — geralmente cascata de outro erro |
| `100` | Parâmetro inválido — ver subcode para detalhes |

---

## Padrões de Texto Skippable

Erros que contêm esses padrões são tratados como skip (não falha fatal):

- `not eligible`
- `cannot be used`
- `cannot be promoted`
- `not promotable`
- `media cannot`
- `direitos autorais`
- `copyright`
- `music rights`
