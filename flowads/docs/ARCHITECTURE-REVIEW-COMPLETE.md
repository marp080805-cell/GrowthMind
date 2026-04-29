# Revisão Arquitetural Completa - Meta Ads Compliance 100%

**Data:** 2026-04-28  
**Objetivo:** Analisar TODAS as violações potenciais e redesenhar para 100% conformidade com políticas Meta

---

## PARTE 1: MAPA COMPLETO DO SISTEMA

### Fluxo de Operações - Por Tipo

#### 1. CRIAÇÃO DE CAMPANHAS
**Arquivo:** `executor.ts:1331-1354`
```
create_campaign → meta.createCampaign(campaign_id, name, objective, budget)
- Sem rate limit individual
- Sem limite global
- Pode ser disparado 100x em paralelo
- RISCO: CRÍTICO
```

#### 2. CRIAÇÃO DE ADSETS
**Arquivo:** `executor.ts:1355-1367`
```
create_adset → meta.createAdSet(campaign_id, targeting, budget)
- Sem rate limit
- Sem limite global
- Pode ser disparado 100x em paralelo
- RISCO: CRÍTICO
```

#### 3. CRIAÇÃO DE ADS
**Arquivo:** `executor.ts:1201-1322`
```
create_ad → meta.createAd({adset_id, creative_id, name, status})
- Rate limit: 8/hora (POR CLIENTE, não por account)
- MAS: Se 20 clientes da mesma account rodarem, = 160/hora = META BLOQUEIA
- RISCO: CRÍTICO
```

#### 4. CRIAÇÃO DE ADS DO INSTAGRAM (Loop)
**Arquivo:** `executor.ts:1454-1532`
```
create_ads_from_new_posts → Loop: 20 posts → 20 ads em minutos
- Delay entre items: 30-60s (configurável)
- MAS: Se 5 automações desse tipo rodam juntas = 100 ads em minutos
- RISCO: CRÍTICO
```

#### 5. UPLOAD DE CRIATIVOS
**Arquivo:** `meta.service.ts:1280-1330`
```
uploadAdImage/uploadAdVideo → fetch POST /act_{id}/adimages
- Sem rate limit
- Vídeo: 3min timeout por upload
- Se 20 automações uploadam vídeos = bottleneck gigante
- RISCO: ALTO (performance + detection)
```

#### 6. EDIÇÃO/PAUSA/ATIVAÇÃO
**Arquivo:** `executor.ts:1554-1610`
```
edit_campaign, edit_adset, edit_ad, pause_ad, activate_ad
- Rate limit: 3/dia por objeto
- MAS: Se 10 automações editam o mesmo ad = 30 edições em segundos
- RISCO: CRÍTICO
```

#### 7. DUPLICAÇÃO DE CAMPANHAS
**Arquivo:** `executor.ts:1533-1540`
```
duplicate_campaign → meta.duplicateCampaign()
- Rate limit: 1/original/dia
- Sem limite total de duplicações
- RISCO: MÉDIO
```

---

## PARTE 2: ANÁLISE DE CONCORRÊNCIA

### Problema Arquitetural #1: MÚLTIPLAS AUTOMAÇÕES SEM ISOLAMENTO

**Cenário Real:**
```
Automação A (scheduler 19:00) → create_ads_from_new_posts (20 ads)
Automação B (scheduler 19:00) → create_ads_from_new_posts (20 ads)
Automação C (scheduler 19:00) → edit_campaign
Automação D (scheduler 19:00) → create_campaign
Automação E (webhook) → create_ad (async)
... 20 automações da mesma conta ...

Resultado em 30 segundos:
- 100+ requisições META
- 100+ criações paralelas
- BURST DETECTION ATIVA = BAN
```

**Onde Falha:**
- `scheduler.ts` - Dispara múltiplas automações em paralelo
- `executor.ts` - Cada automação é independente, sem coordenação
- `meta-protection.ts` - Rate limit é POR CLIENTE, não por ACCOUNT
- `webhooks.routes.ts` - Dispara automações sem fila

**Rating:** CRÍTICO - Arquitetura não suporta concorrência segura

---

### Problema Arquitetural #2: FALTA DE FILA CENTRALIZADA

**Situação Atual:**
```
Automação 1 → meta.createAd() → API Meta (AGORA)
Automação 2 → meta.createAd() → API Meta (AGORA)
Automação 3 → meta.createAd() → API Meta (AGORA)
Tudo simultâneo = Burst
```

**Situação Ideal:**
```
Automação 1 → Enfileira → FILA GLOBAL → WORKER → API Meta (sequencial)
Automação 2 → Enfileira → FILA GLOBAL → WORKER → API Meta (1s depois)
Automação 3 → Enfileira → FILA GLOBAL → WORKER → API Meta (2s depois)
```

**Onde Deveria Estar:** Não existe. Precisa ser criado.

**Rating:** CRÍTICO - Sem fila, impossível garantir segurança

---

### Problema Arquitetural #3: RATE LIMITING ERRADO

**Implementação Atual:**
```typescript
const MAX_ADS_PER_CLIENT_PER_HOUR = 5
const MAX_ADS_PER_ACCOUNT_PER_HOUR = 8

// Cliente 1 cria 5 ads ✓
// Cliente 2 cria 5 ads ✓
// Cliente 3 cria 5 ads ✓
// Cliente 4 tenta criar = BLOQUEADO
// MAS: Se todos rodarem em paralelo = 15 ads em 10 segundos = BAN
```

**Problema:** Limite por cliente é inútil se todos rodam juntos

**Rating:** CRÍTICO - Rate limiting não funciona com paralelismo

---

## PARTE 3: OPERAÇÕES DESCOBERTAS SEM PROTEÇÃO

### 1. Criação de Campanhas
- **Status:** SEM PROTEÇÃO
- **Risco:** Pode criar 100 campaigns em minutos
- **Meta Policy:** Máx ~5-10/hora recomendado
- **Código:** `executor.ts:1331-1354`
- **Fix Necessário:** Rate limit + fila

### 2. Criação de Adsets
- **Status:** SEM PROTEÇÃO
- **Risco:** Pode criar 100 adsets em minutos
- **Meta Policy:** Máx ~10/hora recomendado
- **Código:** `executor.ts:1355-1367`
- **Fix Necessário:** Rate limit + fila

### 3. Upload de Vídeos
- **Status:** SEM PROTEÇÃO (timeout existe, rate limit não)
- **Risco:** Vários uploads em paralelo = bottleneck + detection
- **Meta Policy:** Máx ~3 simultâneos recomendado
- **Código:** `meta.service.ts:1280-1330`
- **Fix Necessário:** Fila sequencial por account

### 4. Criação de Públicos
- **Status:** SEM PROTEÇÃO (se bloco existe)
- **Risco:** Criação em massa de audiences
- **Meta Policy:** Máx ~3/hora
- **Código:** Procurar por `create_audience`
- **Fix Necessário:** Rate limit + fila

### 5. Mudanças de Targeting
- **Status:** SEM PROTEÇÃO
- **Risco:** Mudanças rápidas parecem bot
- **Meta Policy:** Máx ~1-2/dia por adset
- **Código:** `executor.ts:1565-1573`
- **Fix Necessário:** Rate limit por objeto por DAY

---

## PARTE 4: PROBLEMAS ADICIONAIS

### Problema #1: Não há Isolamento por Ad Account
```
Cliente A e Cliente B compartilham a mesma ad account
Automações rodam em paralelo
Meta não consegue distinguir quem fez o quê
Resultado: Ban no account inteiro
```
**Fix:** Isolar execução por ad account com mutex/lock

### Problema #2: Tokens de Múltiplos Clientes no Mesmo Lugar
```
Settings table: meta_token = token global
Todos os clientes usam o mesmo token
Se 1 cliente faz coisa ruim, TODOS são banidos
```
**Fix:** Tokenizar corretamente (cliente → seu próprio token)

### Problema #3: Webhooks Podem Disparar Automações Sem Controle
```
POST /webhooks/node123 (sem autenticação antes)
→ Dispara automação
→ Cria 20 ads em sequência
→ Sem considerar que outras 19 automações estão rodando
```
**Fix:** Webhook também vai pra fila central

### Problema #4: Logging de Requisições Meta
```
Console.log mostra payloads com tokens/dados sensíveis
Se logs vão pro Sentry/DataDog = exposição
```
**Fix:** Redaction automática (já feito, mas precisa ser usado)

### Problema #5: Sem Monitoramento de Saúde da Conta
```
Automação roda mesmo que BM foi restringida
Continua tentando fazer requisições Meta
Meta vê tentativas = mais punishment
```
**Fix:** Health check antes de cada lote de requisições

---

## PARTE 5: ARQUITETURA PROPOSTA (100% CONFORME)

### Diagrama:

```
┌─────────────────────────────────────────────────┐
│         CAMADA DE ENTRADA                        │
├─────────────────────────────────────────────────┤
│  Scheduler       Webhook       Manual Trigger    │
│       ↓               ↓                ↓         │
└─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────┐
│    VALIDATION & QUEUING LAYER                   │
├─────────────────────────────────────────────────┤
│  1. Validate automação → não viola políticas    │
│  2. Check account health → não tá restringida   │
│  3. Enfileirar em: rl:account:{id}:queue        │
│  4. Return: job_id para tracking                │
└─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────┐
│    QUEUE LAYER (Redis + BullMQ)                 │
├─────────────────────────────────────────────────┤
│  rl:account:123:queue → [job1, job2, job3...]   │
│  rl:account:456:queue → [jobA, jobB...]         │
│  rl:global:queue → [all accounts]               │
│                                                 │
│  Concurrency: 1 worker por account              │
│  Retry: 3x com backoff                          │
│  TTL: 24 horas                                  │
└─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────┐
│    EXECUTION LAYER (Worker)                     │
├─────────────────────────────────────────────────┤
│  1. Dequeue job                                 │
│  2. Pre-flight checks:                          │
│     - Rate limit ainda permite?                 │
│     - Account ainda saudável?                   │
│     - Request é válida?                         │
│  3. Execute com timeout                         │
│  4. Post-flight:                                │
│     - Log com redaction                         │
│     - Update rate limit                         │
│     - Retry se falhou                           │
│  5. Mark complete                               │
└─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────┐
│    META GRAPH API                               │
├─────────────────────────────────────────────────┤
│  Requisição única por vez por account           │
│  Delays realisticos entre requisições           │
│  Error handling per API response                │
└─────────────────────────────────────────────────┘
```

### Políticas Implementadas:

```
CAMPAIGN CREATION:
  - Max 5/hora por account
  - Max 1 simultâneo
  - Fila sequencial

ADSET CREATION:
  - Max 10/hora por account
  - Max 1 simultâneo
  - Fila sequencial

AD CREATION:
  - Max 8/hora por account
  - Max 1 simultâneo
  - Fila sequencial
  - Pre-flight: check elegibilidade

EDITING:
  - Max 3/dia por objeto (ad/campaign/adset)
  - Max 1 simultâneo
  - Global lock

VIDEO UPLOAD:
  - Max 5/hora por account
  - Max 1 simultâneo
  - 3min timeout
  - Fila sequencial

AUDIENCE CREATION:
  - Max 3/hora por account
  - Max 1 simultâneo
  - Fila sequencial

ACCOUNT OPERATIONS:
  - Health check a cada 5 min
  - Stop automações se account restringida
  - Alert admin
```

---

## PARTE 6: IMPLEMENTAÇÃO NECESSÁRIA

### Arquivos Novos:

1. **account-queue-manager.ts**
   - Gerencia fila por account
   - Concurrency control
   - Rate limiting global

2. **account-health-monitor.ts**
   - Monitora saúde de cada ad account
   - Deteta restrições
   - Para automações

3. **request-validator.ts**
   - Valida cada request ANTES de enfilar
   - Verifica políticas Meta
   - Calcula impacto de request

4. **queue-worker.ts**
   - Processa 1 job por account
   - Mantém concorrência = 1
   - Retry logic seguro

### Arquivos Modificados:

1. **scheduler.ts**
   - Enfileira ao invés de executar direto
   - Respeita fila central

2. **webhooks.routes.ts**
   - Enfileira webhook ao invés de executar
   - Respeita fila central

3. **executor.ts**
   - Remove lógica de filas (vai pro worker)
   - Remove rate limiting local (usa global)
   - Adiciona validação pré-vôo

4. **meta-protection.ts**
   - Expande com rate limits globais
   - Adiciona health check
   - Adiciona validação de políticas

---

## PARTE 7: TIMELINE DE IMPLEMENTAÇÃO

### FASE 1: Infraestrutura (1 dia)
- [ ] Criar account-queue-manager.ts
- [ ] Criar queue-worker.ts
- [ ] Integrar com Redis/BullMQ
- [ ] Testes unitários

### FASE 2: Validação (1 dia)
- [ ] Criar request-validator.ts
- [ ] Criar account-health-monitor.ts
- [ ] Integrar na pipeline

### FASE 3: Integração (1 dia)
- [ ] Modificar scheduler.ts
- [ ] Modificar webhooks.routes.ts
- [ ] Modificar executor.ts
- [ ] Testes E2E

### FASE 4: Deploy e Monitoramento (1 dia)
- [ ] Deploy em staging
- [ ] Monitorar com métricas
- [ ] Deploy em produção
- [ ] Monitorar em real-world

---

## CONCLUSÃO

O sistema atual **NÃO É SEGURO** contra detecção de automação pela Meta porque:

1. ❌ Múltiplas automações podem rodar em paralelo
2. ❌ Não há fila centralizada por account
3. ❌ Rate limiting é por cliente, não por account global
4. ❌ Sem isolamento de execução
5. ❌ Sem health check de conta
6. ❌ Sem validação pré-vôo de requisições

**Resultado:** Mesmo com as 14 proteções adicionadas, um usuário com 20 automações pode causar ban em minutos.

**Solução:** Implementar queue architecture com concurrency=1 por account e rate limiting global.

Isso é a **verdadeira blindagem contra bloqueios da Meta**.
