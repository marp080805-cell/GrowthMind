# Auditoria de Segurança - Violações de Políticas Meta Ads

**Data da auditoria:** 2026-04-28  
**Status:** 14 problemas encontrados (4 CRÍTICOS, 7 ALTOS, 3 MÉDIOS)  
**Risco:** Business Manager pode ser bloqueado em horas/dias se usado ativamente

---

## CRÍTICOS - Corrigir HOJE

### 1. Criação em Massa de Anúncios sem Delay Suficiente

**Arquivo:** `flowads/backend/src/jobs/executor.ts:1439-1516` (bloco `create_ads_from_new_posts`)

**Problema:**
```typescript
for (const post of newPosts) {
  await meta.createAdFromInstagramPost(...)  // SEM DELAY
}
```

Cria múltiplos anúncios em sequência sem delays naturais. Loop pode processar até 100 itens em minutos.

**Violação:** Política Meta #1 (Criação em Massa) + #2 (Imitação de Atividade Humana)

**Risco:** Meta detecta como "rapid-fire automation" = bloqueio automático da conta

**Fix:** 
- ✅ Já implementado: `delay_between_items` no loop (30-60s recomendado)
- ⚠️ Falta: Fazer o delay **aleatório** (não determinístico)
- ⚠️ Falta: Aplicar delay também em `create_ads_from_new_posts` (não usa loop)

---

### 2. Rate Limiting INSUFICIENTE (30 ads/hora = PERIGOSO)

**Arquivo:** `flowads/backend/src/jobs/meta-protection.ts:18-20`

**Problema:**
```typescript
const MAX_ADS_PER_ACCOUNT_PER_HOUR = 30  // ← MUITO ALTO
```

Meta bloqueia contas com >5-8 ações suspeitas/hora. Limite de 30 é extremamente perigoso.

**Risco:** Um cliente com 3 automações rodando = 30 ads em minutos = BAN

**Fix:**
- Reduzir para **5-8 ads/hora por account**
- Sincronizar com Redis (não em-memory)
- Registrar TODAS as ações, não só anúncios (pausa, edição, etc.)

---

### 3. Tokens Meta em PLAINTEXT + Multi-Tenancy Insegura

**Arquivo:** `flowads/backend/src/lib/types.ts:30-44` + `flowads/backend/src/routes/clients.routes.ts:7-18`

**Problema:**
```typescript
interface Client {
  meta_token: string  // Armazenado em TEXTO PLANO
}

GET /clients → Retorna TODOS os clientes + tokens sem isolamento
```

**Risco:** 
- Um breach = acesso a TODAS as ad accounts de TODOS os clientes
- Admin malicioso = acesso a contas alheias
- Qualquer outro app/serviço roubando tokens

**Violação:** Política Meta #3 (Dados Sensíveis)

**Fix:**
- Usar AWS Secrets Manager ou Supabase Vault (encryption at rest)
- Nunca retornar tokens em GET /clients
- Tokenizar acesso (gerar session token, não expor meta_token)

---

### 4. Manipulação Automática de Orçamento/Status sem Limites

**Arquivo:** `flowads/backend/src/jobs/executor.ts:1539-1600`

**Problema:**
```typescript
case 'adjust_budget': {
  await meta.updateBudget(...)  // SEM LIMITE
}
case 'activate_ad': {
  await meta.updateAdStatus(...)  // SEM VALIDAÇÃO
}
```

Loop pode pausar/ativar/editar o **mesmo anúncio 100x** em uma execução.

**Risco:** Meta detecta como bot manipulation

**Fix:**
- Rate limit por objeto: máx 3 edições/dia por ad
- Validar mudança de status é necessária (não já em status alvo)
- Adicionar log auditável

---

## ALTOS - Corrigir essa semana

### 5. Sem Validação de URL de Destino

**Arquivo:** `flowads/backend/src/jobs/executor.ts:1280-1302`

**Problema:**
```typescript
link_url: config.link_url as string | undefined  // Aceita qualquer URL
```

**Violações possíveis:**
- URL encurtada (bit.ly, tinyurl) - Meta proíbe
- Mismatch: imagem = "Iphone", URL = dropshipping de óculos
- Phishing/malware

**Fix:**
```typescript
function validateAdUrl(url: string) {
  // 1. HTTPS obrigatório
  // 2. Não encurtadores (verificar hosts proibidos)
  // 3. Verificar landing page retorna 200 + Content-Type válido
  // 4. Se possível, verificar FAVICON/TITLE corresponde ao anúncio
}
```

---

### 6. Duplicação Automática de Campanhas em Massa

**Arquivo:** `flowads/backend/src/jobs/executor.ts:1518-1524`

**Problema:**
```typescript
case 'duplicate_campaign': {
  await meta.duplicateCampaign(campaign_id, new_name)  // SEM LIMITE
}
```

Loop + Duplicate Campaign = 100 campanhas idênticas em minutos.

**Risco:** Política Meta proíbe "creative duplication patterns"

**Fix:**
- Rate limit: máx 1 duplicação por original/dia
- Validar se campaign já tem 10+ duplicatas (suspicioso)

---

### 7. Webhooks SEM Autenticação

**Arquivo:** `flowads/backend/src/routes/webhooks.routes.ts:6-47`

**Problema:**
```typescript
fastify.post('/webhooks/:nodeId', async (req, reply) => {
  const secret = node.config?.secret
  if (secret) {
    if (providedSecret !== secret) return 401  // OPCIONAL!
  }
  // Executa automação SEM VALIDAÇÃO SE NAO TEM SECRET
  executeAutomation(node.automation_id, payload)
})
```

**Risco:** Qualquer pessoa descobre `nodeId` = dispara automações

**Fix:**
```typescript
// Exigir Bearer token OAuth ou API key
const authHeader = req.headers.authorization
if (!authHeader?.startsWith('Bearer ')) return 401
// Validar token com Supabase
```

---

### 8. Sem Validação de Elegibilidade de Post Antes de Criar Ad

**Arquivo:** `flowads/backend/src/jobs/executor.ts:1224-1242`

**Problema:**
```typescript
const boostInfo = postData.boost_eligibility_info
if (boostInfo && boostInfo.eligible_to_boost === false) {
  return { success: false }  // Retorna erro
}
// MAS CONTINUA
const result = await meta.createAdFromInstagramPost(...)  // Cria mesmo assim
```

**Risco:** Posts inelegíveis (copyright, música protegida) = requests que falham = burst detection aciona

**Fix:**
```typescript
if (!boostInfo?.eligible_to_boost) {
  throw new Error('Post inelegível para boost')  // Para execução
}
```

---

### 9. IA Gerando Conteúdo SEM Moderação

**Arquivo:** `flowads/backend/src/jobs/executor.ts:1706-1745`

**Problema:**
```typescript
const request = {
  systemPrompt: config.system_prompt,
  humanMessage: config.human_message
}
result = await svc.complete(request)
// Output vai direto para anúncio SEM VALIDAÇÃO
```

**Risco:** IA pode gerar:
- Conteúdo de ódio
- Nudez/sexual
- Drogas/álcool
- Fake news
- Esquemas de pirâmide

**Fix:**
```typescript
// Integrar Perspective API (Google) ou Azure Content Moderator
const toxicity = await moderationService.check(aiOutput)
if (toxicity.score > 0.7) {
  throw new Error('Conteúdo rejeitado: toxicity alta')
}
```

---

### 10. Stagger DETERMINÍSTICO (Detectável como Bot)

**Arquivo:** `flowads/backend/src/jobs/scheduler.ts:26-33`

**Problema:**
```typescript
function staggerSeconds(automationId: string): number {
  let hash = 0
  for (let i = 0; i < automationId.length; i++) {
    hash = (hash * 31 + automationId.charCodeAt(i)) >>> 0
  }
  return hash % 60  // SEMPRE MESMO DELAY PARA MESMA AUTOMAÇÃO
}
```

**Risco:** Meta ML deteta: mesmo delay = bot

**Fix:**
```typescript
// Adicionar random (30-180s range)
const deterministic = hash % 60
const random = Math.random() * 120  // 0-120s adicional
return deterministic + random
```

---

### 11. Sem Validação de Landing Page

**Arquivo:** `flowads/backend/src/services/meta.service.ts:1280-1302`

**Problema:**
```typescript
destinationUrl: params.destinationUrl || ''  // Sem validação
```

Pode-se criar ad com imagem de "Iphone" mas URL leva a dropshipping.

**Fix:**
```typescript
async function validateLandingPage(url: string, adText: string) {
  const response = await fetch(url)
  const html = await response.text()
  
  // 1. Verificar status 200
  // 2. Verificar conteúdo é relevante (não redirect)
  // 3. Verificar tem Privacy Policy + ToS (se necessário)
  // 4. Verificar Meta Pixel está instalado (se apropriado)
}
```

---

## MÉDIOS - Corrigir próximas 2 semanas

### 12. Rate Limiting em Memória (Não Sincronizado)

**Arquivo:** `flowads/backend/src/jobs/meta-protection.ts:5-10`

**Problema:**
```typescript
const apiCallTracker = new Map(...)  // Em MEMÓRIA
const clientExecutionTracker = new Map(...)  // Em MEMÓRIA
```

Se múltiplos workers rodam mesma automação = limite não sincroniza = bypass

**Fix:**
```typescript
// Usar Redis com TTL
const key = `rate:${clientId}:${adAccountId}:${hour}`
const count = await redis.incr(key)
await redis.expire(key, 3600)  // Reset a cada hora
```

---

### 13. Tokens em Logs (Exposição)

**Arquivo:** `flowads/backend/src/services/meta.service.ts` + `executor.ts`

**Problema:**
```typescript
console.log(`[Meta] payload:`, JSON.stringify({ ...body, access_token: '[REDACTED]' }))
```

Apesar do `[REDACTED]`, podem vazar em:
- Error stack traces
- Debug logs enviados a terceiros
- Container logs

**Fix:**
```typescript
// Usar structured logging com redação automática
logger.info('meta_request', {
  action: 'create_ad',
  status: 'pending',
  client_id: '***',  // Redact
  // Nunca log: access_token, meta_token, etc.
})
```

---

### 14. Sem Timeout para Upload de Vídeo

**Arquivo:** `flowads/backend/src/services/meta.service.ts:1253-1318`

**Problema:**
```typescript
private async waitForVideoReady(videoId: string, maxWaitMs = 180_000) {
  while (true) {
    const status = await this.getVideoStatus(videoId)
    if (status === 'READY') return
    await sleep(5000)
    // Loop indefinido se status nunca muda
  }
}
```

**Risco:** Automação fica pendente 3+ minutos = bloqueia worker

**Fix:**
```typescript
const startTime = Date.now()
while (Date.now() - startTime < maxWaitMs) {
  const status = await this.getVideoStatus(videoId)
  if (status === 'READY') return
  if (status === 'ERROR') throw new Error('Video upload failed')
  await sleep(5000)
}
throw new Error('Video upload timeout after 3 minutes')
```

---

## PLANO DE AÇÃO

### 🔴 HOJE (Críticos)
- [ ] Reduzir `MAX_ADS_PER_ACCOUNT_PER_HOUR` de 30 para 8
- [ ] Aplicar delay aleatório em `create_ads_from_new_posts`
- [ ] Iniciar migração de tokens para Supabase Vault

### 🟠 Esta Semana (Altos)
- [ ] Validação de URL (obrigatório HTTPS, não encurtadores)
- [ ] Rate limit por objeto (máx 3 edições/dia)
- [ ] Autenticação em webhooks
- [ ] Content moderation para IA output
- [ ] Randomizar stagger

### 🟡 Próximas 2 semanas (Médios)
- [ ] Rate limiting em Redis
- [ ] Structured logging (sem tokens)
- [ ] Melhorar timeout de vídeo

---

## Impacto se não corrigir

- **Semana 1:** Mais Business Managers restringidas
- **Semana 2:** Meta pode escalalar para suspensão de conta completa
- **Semana 3+:** Impossível trabalhar com Meta Ads sem novos BM

