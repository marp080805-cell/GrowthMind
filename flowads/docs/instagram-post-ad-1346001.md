# Erro 1346001 — Anúncios de Post do Instagram (Campanha de Seguidores/Visita ao Perfil)

## Status atual

**NÃO RESOLVIDO via API.** Workaround ativo: criar ad como PAUSED + notificação WhatsApp para ativação manual.

---

## Descrição do problema

Ao criar anúncios a partir de posts do Instagram via `source_instagram_media_id` em campanhas com `optimization_goal: VISIT_INSTAGRAM_PROFILE` ou `FOLLOWERS`, o anúncio é criado mas fica com status `WITH_ISSUES` / `Não está em veiculação` com o erro:

```
Validation Error: A validation error occurred. (#1346001)
```

A ativação manual no Ads Manager resolve imediatamente o problema (o anúncio começa a veicular). A API pública não consegue replicar esse comportamento.

---

## O que foi investigado e tentado

### Tentativa 1 — CTA VIEW_INSTAGRAM_PROFILE em campanhas de seguidores

**Hipótese:** faltava o CTA no criativo.

**O que fizemos:** adicionamos `call_to_action: { type: 'VIEW_INSTAGRAM_PROFILE', value: { link: igProfileUrl } }` em todos os criativos de campanhas com `destination_type: INSTAGRAM_PROFILE`.

**Resultado:** piorou — campanhas de seguidores (FOLLOWERS) passaram a dar 1346001 hardcoded porque `VIEW_INSTAGRAM_PROFILE` é incompatível com esse objetivo. Campanhas de tráfego (VISIT_INSTAGRAM_PROFILE) continuaram com o erro.

**Fix:** diferenciar pelo `optimization_goal`:
- `VISIT_INSTAGRAM_PROFILE` → adicionar CTA `VIEW_INSTAGRAM_PROFILE` no criativo
- `FOLLOWERS` / outros → NÃO adicionar CTA (herdado do adset)

---

### Tentativa 2 — Delay de 5 minutos antes de ativar (BullMQ)

**Hipótese:** a Meta precisava de tempo para processar o media do post antes da ativação.

**O que fizemos:** criar o ad como PAUSED, agendar job BullMQ para ativar 5 minutos depois via `POST /{adId} {status: ACTIVE}`.

**Resultado:** 1346001 persistiu nas 3 tentativas do BullMQ. O delay não resolveu nada.

**Por que não funcionou:** o post já existe no Instagram — não há mídia nova para processar. O problema não era timing.

---

### Tentativa 3 — Reativar após WITH_ISSUES (checkAndReactivate)

**Hipótese:** reativar o ad quando WITH_ISSUES é detectado (igual ao clique manual).

**O que fizemos:** após ativar via API, checar status 30s depois. Se WITH_ISSUES, chamar `POST /{adId} {status: ACTIVE}` novamente (até 2 tentativas, 60s de intervalo).

**Resultado:** todas as tentativas falharam com o mesmo 1346001. A ativação via `POST /{adId} {status: ACTIVE}` **nunca** resolve WITH_ISSUES — não importa quantas vezes seja chamada.

---

### Tentativa 4 — Criar ad diretamente como ACTIVE (sem PAUSED intermediário)

**Hipótese:** o caminho `PAUSED → ACTIVE` dispara uma validação mais restrita que o caminho `create-and-publish` (status=ACTIVE direto).

**Investigação DevTools:** o Ads Manager usa `addraft_fragments_with_publish` + `addraft_publish_statuses` no domínio `adsmanager-graph.facebook.com` — endpoints internos que requerem cookies de sessão de browser e IDs internos de sessão (`_callFlowletID`, `_triggerFlowletID`, `sessionID`, etc.). Impossível replicar via API pública com token de sistema.

**O que fizemos:** criar o ad diretamente via `POST /act_{id}/ads` com `status: ACTIVE` (sem jamais criar como PAUSED).

**Resultado:** 1346001 persiste mesmo criando diretamente como ACTIVE. A hipótese estava errada — o problema não é o path de criação, é algo na validação da combinação criativo + campanha que só o endpoint interno do Ads Manager consegue contornar.

---

## Root cause real (conclusão da investigação)

O Ads Manager usa um sistema interno de draft (`addraft_*`) para publicar anúncios que **não está exposto na API pública do Graph**. Esse sistema interno bypassa ou trata diferentemente a validação que gera o 1346001. A API pública — seja via criação direta como ACTIVE ou via transição PAUSED→ACTIVE — **sempre** dispara essa validação para anúncios de post do Instagram em campanhas de perfil/seguidores.

O `mid: 04e91cc5bc96dba2fd6f1ad29f37628e` aparece igual em todos os ads afetados, indicando que é um hash da combinação de parâmetros que gera o erro, não um identificador de sessão.

---

## O que FUNCIONA

- **Ativação manual no Ads Manager**: clicando no botão de ativar, o Ads Manager usa o endpoint interno `addraft_publish_statuses` → ad ativa sem erro.
- **Campanhas de tráfego para site** (não perfil IG): criação via API funciona normalmente, sem 1346001.

---

## Workaround atual

**Criar o ad como PAUSED e notificar o usuário via WhatsApp para ativar manualmente.**

O ad é criado com sucesso (creative + ad object), visível no Ads Manager. O usuário recebe notificação com o link direto para ativar. Leva ~5 segundos de trabalho manual.

### Fluxo de automação configurado:
1. Buscar posts elegíveis
2. Filtrar posts já em anúncio
3. Criar anúncio (status: PAUSED) → retorna `ad_id` real
4. Notificar WhatsApp: "Ad criado, acesse o Ads Manager para ativar"

---

## Próximos passos para investigar (quando retomar)

1. **Meta Marketing API v22+ changelog**: verificar se há endpoint documentado equivalente ao `addraft_publish_statuses` em versões novas da API.
2. **`execution_options: ["validate_only"]`**: checar se pré-validar antes de criar muda o comportamento.
3. **Criar via Business Manager API**: `/act_{id}/ads` via Business Suite endpoint (diferente do Marketing API) pode usar path diferente.
4. **Contato com suporte Meta**: abrir ticket com o `mid` e os parâmetros exatos — pode ser um bug de API para esse caso específico.
5. **Testar com campanha TRAFFIC para site → confirmar que funciona → mudar objective para PROFILE_VISIT e testar**: isolar se o problema é o objective ou o `source_instagram_media_id`.

---

## Erros relacionados já resolvidos durante a investigação

| Erro | Causa | Fix |
|------|-------|-----|
| `2446383` | Campanha de tráfego sem URL de destino | Adicionar `destination_url` no nó de criar anúncio |
| `2061015` | Website URL obrigatório no criativo | Mesmo fix acima |
| CTA VIEW_INSTAGRAM_PROFILE em campanha FOLLOWERS | Código adicionava CTA em todos os criativos | Diferenciar por `optimization_goal` |
