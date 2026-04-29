# Proteções Automáticas contra Bloqueio de Business Manager pela Meta

**Data:** 2026-04-28  
**Arquivo:** `flowads/backend/src/jobs/meta-protection.ts`  
**Status:** Implementado e ativo em todas as execuções de automação

---

## Resumo

Após a restrição de uma Business Manager por padrão de automação suspeita, implementamos **4 camadas de proteção automáticas e transparentes** que agem independentemente de como o usuário cria as automações.

O usuário **não precisa fazer nada** — as proteções são aplicadas automaticamente no início de cada execução.

---

## 1. RATE LIMITING POR CLIENTE

### O que faz
Limita quantos anúncios cada cliente pode criar por hora, mesmo que múltiplos clientes usem a mesma ad account.

### Números
- **Máximo por cliente:** 10 anúncios/hora
- **Máximo por ad account:** 30 anúncios/hora (distribuído entre clientes)
- **Janela:** Hora UTC (00:00 a 23:59)

### Como funciona
1. Sistema rastreia em memória quantos anúncios foram criados por cada cliente na hora atual
2. Se cliente A criar 10 anúncios, fica no limite
3. Se cliente B tentar criar mais enquanto estiver na mesma hora, recebe erro e não executa
4. Registros de horas anteriores são automaticamente descartados (cleanup)

### Debug
```typescript
// Se automação foi bloqueada:
// Procure no log: "Cliente {id} atingiu limite de 10 anúncios/hora"
// Ou: "Ad account atingiu limite de 30 anúncios/hora"

// Verificar contadores:
nodeLogs.find(log => log.node_id === 'protection')?.error
// Exemplo output: "Cliente xyz atingiu limite de 10 anúncios/hora"
```

### Customização (se necessário)
```typescript
// Em meta-protection.ts, mudar:
const MAX_ADS_PER_CLIENT_PER_HOUR = 10  // ← aumentar para 15, 20, etc.
const MAX_ADS_PER_ACCOUNT_PER_HOUR = 30 // ← aumentar para 50, etc.
```

---

## 2. STAGGER AUTOMÁTICO ENTRE CLIENTES

### O que faz
Se 2+ clientes usam a mesma ad account e têm automações agendadas para o mesmo horário, o sistema escalonaSua execução automaticamente para evitar rajadas simultâneas.

### Exemplo
```
Cliente A automação: agendada para 19:00
Cliente B automação: agendada para 19:00
Cliente C automação: agendada para 19:00

Sistema executa:
- Cliente A: 19:00:00
- Cliente B: 19:05:00 (staggered +5min)
- Cliente C: 19:10:00 (staggered +10min)
```

### Como funciona
1. No agendamento (scheduler.ts), calcular stagger dinâmico
2. Encontrar todas as automações da mesma ad account com mesmo horário
3. Ordenar clientes alfabeticamente (determinístico)
4. Adicionar 5 minutos de delay para cada cliente
5. Adicionar delay ao job na fila BullMQ

### Debug
```typescript
// Se automação rodou em horário diferente do esperado:
// Verificar log do scheduler: "[CronDispatcher] automação {id} — delay: {ms}ms"

// O delay é visível em:
automationQueue.add(..., { delay: staggeredDelay })
```

### Customização (se necessário)
```typescript
// Em meta-protection.ts, mudar:
return Math.max(0, clientIndex * 5 * 60 * 1000) // ← mudar 5 para 10, 15 min, etc.
```

---

## 3. HEALTH CHECK DA AD ACCOUNT

### O que faz
Antes de executar qualquer automação, verifica se a ad account não foi restringida pela Meta e se o token é válido.

### Verifica
- ✓ Token OAuth ainda é válido (erro 190 = token inválido/expirado)
- ✓ Ad account não foi restringida (erro 1346001, 100 = restrição)
- ✓ Account não precisa de check-in (account_status = 2)

### Como funciona
1. Fazer GET para `https://graph.instagram.com/v21.0/act_{adAccountId}?fields=name,account_status`
2. Verificar presença de erros da Meta
3. Se erro 190 → token inválido
4. Se erro 1346001 ou 100 → account restringida
5. Se account_status = 2 → account precisa check-in

### Debug
```typescript
// Se health check falhar:
// Log de erro: "[Protection] Automação {id} bloqueada: Token inválido ou expirado"
//           ou "[Protection] Automação {id} bloqueada: Ad account pode estar restringida"

nodeLogs.find(log => log.node_type === 'system')?.error
```

### O que faz se falhar
- ❌ **Não executa** a automação
- ✓ Registra erro no execution_log com status 'error'
- ✓ Retorna executionId vazio (falha graceful)
- ✓ Próxima automação agendada vai tentar novamente

---

## 4. DETECÇÃO DE RAJADAS (BURST DETECTION)

### O que faz
Monitora volume de chamadas à API da Meta em janelas de tempo. Se detectar padrão suspeito (muitas chamadas em 5 minutos), pausa automações automaticamente.

### Números
- **Threshold:** 50 chamadas/5 minutos por ad account
- **Janela:** 5 minutos deslizante
- **Ação:** Bloqueia execução se ultrapassar

### Como funciona
1. Cada chamada à API da Meta é registrada com timestamp
2. Sistema calcula quantas chamadas aconteceram nos últimos 5 minutos
3. Se > 50 chamadas → pausa automática
4. Log de aviso é gerado (pode ser expandido para Slack/email)

### Debug
```typescript
// Se burst foi detectado:
// Log: "[Burst Detection] Ad account {id} ultrapassou 50 chamadas em 5 min ({total} registradas)"

nodeLogs.find(log => log.error?.includes('Muita atividade'))?.error
// Output: "Muita atividade na API (87 chamadas em 5 min) — pausa automática aplicada"
```

### Onde chamadas são registradas
Atualmente, burst detection rastreia **potencialmente** mas não registra todas as chamadas (requer integração com MetaService para capturar cada HTTP request). Está pronto estruturalmente, pode ser ativado com:

```typescript
// Em executor.ts ou meta.service.ts, adicionar antes de cada fetch:
import { recordApiCall } from './meta-protection'
recordApiCall(adAccountId)
```

### Customização (se necessário)
```typescript
// Em meta-protection.ts:
const BURST_THRESHOLD = 50         // ← mudar para 30, 75, etc.
const BURST_WINDOW_MS = 5 * 60 * 1000 // ← mudar para 10 min, etc.
```

---

## 5. INTEGRAÇÃO: FLUXO DE EXECUÇÃO

### Ordem de validação
```
Automação disparada
  ↓
[1] Validação pré-execução (validateAutomationExecution)
  ├─ Rate limit check
  ├─ Health check
  └─ Burst detection
  ↓
  Se bloqueado → ERROR log + return
  ↓
  Se OK → Prosseguir com execução normal
  ↓
Depois de criar anúncios
  ↓
[2] Registrar contagem (incrementClientAdCount)
  └─ Atualiza contador de rate limit
  ↓
Retornar sucesso
```

### Códigos de erro esperados
```
"Cliente {id} atingiu limite de 10 anúncios/hora"
→ Rate limit atingido, aguardar próxima hora

"Ad account atingiu limite de 30 anúncios/hora"
→ Limite total da conta atingido (distribuído entre clientes)

"Token inválido ou expirado"
→ Meta token precisa ser renovado (admin task)

"Ad account pode estar restringida pela Meta"
→ BM foi restringida, contato com Meta Support necessário

"Muita atividade na API ({X} chamadas em 5 min) — pausa automática aplicada"
→ Padrão de rajada detectado, aguardar 5 minutos
```

---

## Resumo técnico para debug

| Proteção | Arquivo | Função | Ativa em | Bloqueia |
|----------|---------|--------|----------|----------|
| Rate limit | meta-protection.ts | `checkClientRateLimit` | validateAutomationExecution | Sim |
| Stagger | scheduler.ts | `calculateAutomaticStagger` | initCronDispatcher (linha 157) | Não (delay) |
| Health check | meta-protection.ts | `checkAdAccountHealth` | validateAutomationExecution | Sim |
| Burst | meta-protection.ts | `checkBurstDetection` | validateAutomationExecution | Sim (experimental) |

---

## Se algo der errado

### Automação não executa
1. Procure no log: `[Protection] Automação {id} bloqueada`
2. Identifique qual proteção bloqueou (verificar mensagem de erro)
3. Verifique se é:
   - **Rate limit?** → Aguardar próxima hora ou aumentar limite
   - **Health check?** → Revisar token/ad account
   - **Burst?** → Reduzir volume ou aumentar BURST_THRESHOLD

### Contador de rate limit não reseta
- Contador usa hora UTC e reseta a cada hora cheia (00:00, 01:00, etc.)
- Se problema persistir, pode ser timezone issue
- Verificar: `new Date().getHours()` retorna hora UTC

### Muitas automações "staggeradas" causam delay grande
- Se 10 clientes no mesmo horário, último executa +45 minutos depois (cada um +5 min)
- Solução: distribuir automações em horários diferentes (melhor UX)
- Ou: aumentar número de ad accounts (1 por cliente)

---

## Próximos passos (opcional)

1. **Integrar com Slack/Email:** Notificar admin quando burst ou restrição é detectada
2. **Dashboard:** Mostrar uso de rate limit por cliente em tempo real
3. **Machine Learning:** Detectar padrões suspeitos antes da Meta (via histórico de execuções)
4. **Múltiplas ad accounts:** Distribuir clientes automaticamente (load balancing)

