# Meta API — Criação de Anúncios a partir de Posts do Instagram

## Endpoint correto

```
POST /act_{ad-account-id}/adcreatives
```

## Campos obrigatórios para boost de post existente

```json
{
  "name": "Creative - nome do anúncio",
  "source_instagram_media_id": "{instagram-media-id}",
  "instagram_user_id": "{instagram-business-account-id}",
  "access_token": "{token}"
}
```

## ⚠️ Campos que NÃO devem ser usados com source_instagram_media_id

| Campo | Por quê não usar |
|-------|-----------------|
| `object_id` | É para Page post creatives (Facebook). Conflita com `source_instagram_media_id` e causa erro 1815279. |
| `object_story_spec` | Cria dark post — sem conexão com o post original do Instagram. |

## Call to Action (CTA)

O campo `call_to_action` é necessário para campanhas de tráfego. A lógica usada no sistema:

```typescript
const ctaType = destinationUrl.includes('instagram.com')
  ? 'VIEW_INSTAGRAM_PROFILE'  // campanha de visitas ao perfil
  : 'LEARN_MORE'              // campanha de tráfego para site
```

### Tipos de CTA válidos (lista completa da Meta API)

```
BOOK_TRAVEL, CONTACT_US, DONATE, DONATE_NOW, DOWNLOAD, GET_DIRECTIONS,
GO_LIVE, INTERESTED, LEARN_MORE, SEE_DETAILS, LIKE_PAGE, MESSAGE_PAGE,
RAISE_MONEY, SAVE, SEND_TIP, SHOP_NOW, SIGN_UP, VIEW_INSTAGRAM_PROFILE,
INSTAGRAM_MESSAGE, LOYALTY_LEARN_MORE, PURCHASE_GIFT_CARDS, PAY_TO_ACCESS,
SEE_MORE, TRY_IN_CAMERA, WHATSAPP_LINK, GET_IN_TOUCH, TRY_NOW,
ASK_A_QUESTION, START_A_CHAT, CHAT_NOW, ASK_US, CHAT_WITH_US, BOOK_NOW,
CHECK_AVAILABILITY, ORDER_NOW, WHATSAPP_MESSAGE, GET_MOBILE_APP,
INSTALL_MOBILE_APP, USE_MOBILE_APP, INSTALL_APP, USE_APP, PLAY_GAME,
TRY_DEMO, WATCH_VIDEO, WATCH_MORE, OPEN_LINK, NO_BUTTON, LISTEN_MUSIC,
MOBILE_DOWNLOAD, GET_OFFER, GET_OFFER_VIEW, BUY_NOW, BUY_TICKETS,
UPDATE_APP, BET_NOW, ADD_TO_CART, SELL_NOW, GET_SHOWTIMES, LISTEN_NOW,
GET_EVENT_TICKETS, REMIND_ME, SEARCH_MORE, PRE_REGISTER, SWIPE_UP_PRODUCT,
SWIPE_UP_SHOP, PLAY_GAME_ON_FACEBOOK, VISIT_WORLD, OPEN_INSTANT_APP,
JOIN_GROUP, GET_PROMOTIONS, SEND_UPDATES, INQUIRE_NOW, VISIT_PROFILE,
CHAT_ON_WHATSAPP, EXPLORE_MORE, CONFIRM, JOIN_CHANNEL, MAKE_AN_APPOINTMENT,
ASK_ABOUT_SERVICES, BOOK_A_CONSULTATION, GET_A_QUOTE, BUY_VIA_MESSAGE,
ASK_FOR_MORE_INFO, VIEW_PRODUCT, VIEW_CHANNEL, WATCH_LIVE_VIDEO, IMAGINE,
CALL, MISSED_CALL, CALL_NOW, CALL_ME, APPLY_NOW, BUY, GET_QUOTE,
SUBSCRIBE, RECORD_NOW, VOTE_NOW, GIVE_FREE_RIDES, REGISTER_NOW,
OPEN_MESSENGER_EXT, EVENT_RSVP, CIVIC_ACTION, SEND_INVITES, REFER_FRIENDS,
REQUEST_TIME, SEE_MENU, SEARCH, TRY_IT, TRY_ON, LINK_CARD, DIAL_CODE,
FIND_YOUR_GROUPS, START_ORDER
```

> ❌ `INSTAGRAM_PROFILE` **não existe** — o correto é `VIEW_INSTAGRAM_PROFILE`

## Campo destination_url no bloco create_ad

| Valor configurado | CTA type usado | Quando usar |
|-------------------|---------------|-------------|
| Vazio | Busca perfil IG automaticamente → `VIEW_INSTAGRAM_PROFILE` | Campanha de visitas ao perfil |
| `https://instagram.com/...` | `VIEW_INSTAGRAM_PROFILE` | Campanha de visitas ao perfil (manual) |
| `https://seusite.com.br` | `LEARN_MORE` | Campanha de tráfego para site |
| Vazio + sem instagramAccountId | Sem CTA | Campanhas de Engajamento/Reconhecimento |

## Elegibilidade (boost_eligibility_info)

A Meta retorna este campo em cada post do Instagram. Campos corretos:

```typescript
boost_eligibility_info: {
  eligible_to_boost: boolean          // ✅ correto
  boost_ineligibility_reason?: string // ✅ correto
}
```

> ❌ `boost_eligible` e `ineligibility_reason` **não existem** — são nomes errados

## Detecção de posts já patrocinados

Consultar dois campos no creative:

```typescript
fields: 'creative{source_instagram_media_id,effective_instagram_media_id}'
```

- `source_instagram_media_id`: preenchido quando criativo usa boost direto
- `effective_instagram_media_id`: preenchido automaticamente pela Meta em qualquer path

## Compatibilidade por objetivo de campanha

| Objetivo | Compatível com boost de post existente? | Observação |
|----------|----------------------------------------|------------|
| Reconhecimento | ✅ Sim | Sem necessidade de URL |
| Engajamento | ✅ Sim | Sem necessidade de URL |
| Tráfego → Perfil Instagram | ✅ Sim | Requer `VIEW_INSTAGRAM_PROFILE` CTA |
| Tráfego → Site | ✅ Sim | Requer `LEARN_MORE` + URL do site |
| Conversões | ⚠️ Depende | Pode requerer URL e pixel configurado |
| Vendas | ❌ Incompatível geralmente | Requer dark post com especificações de produto |
