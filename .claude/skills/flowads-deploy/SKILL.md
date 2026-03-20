---
name: flowads-deploy
description: >
  Faz o deploy do AdMind na VPS via Docker. Use esta skill sempre que o usuário quiser fazer deploy,
  publicar mudanças, atualizar a aplicação em produção, ou quando mencionar "subir para a VPS",
  "atualizar o servidor", "rebuild dos containers", "colocar em produção" ou qualquer variação.
  Também deve ser usada para diagnósticos de produção como "ver logs do servidor" ou "container caiu".
---

# Deploy do AdMind na VPS

## Contexto

- **VPS path**: `/home/user/AdMind/admind/`
- **Branch de produção**: `claude/flowads-mvp-setup-qI1gt`
- **Containers**: `admind-frontend-1` (8001), `admind-backend-1` (4000), `admind-redis-1` (6379)
- **Rede Docker**: `admind`

---

## Fluxo de deploy

### 1. Verificar o que mudou

Antes de rebuildar tudo, entenda o escopo da mudança para evitar rebuild desnecessário:

```bash
git diff --name-only HEAD~1 HEAD
```

| Mudou | Rebuildar |
|---|---|
| Só `frontend/` | Apenas frontend |
| Só `backend/` | Apenas backend |
| `docker-compose.yml` ou ambos | Tudo |
| Só SQL em `supabase/migrations/` | Não rebuilda — roda migration |

### 2. Puxar o código novo

```bash
cd /home/user/AdMind
git pull origin claude/flowads-mvp-setup-qI1gt
```

Se houver conflito, resolva **antes** de continuar. Nunca force-push em produção.

### 3. Rebuild e restart

**Tudo (após mudanças no docker-compose ou nos dois serviços):**
```bash
cd /home/user/AdMind/admind
docker compose build --no-cache
docker compose up -d
```

**Só o backend:**
```bash
cd /home/user/AdMind/admind
docker compose build backend
docker compose up -d backend
```

**Só o frontend:**
```bash
cd /home/user/AdMind/admind
docker compose build frontend
docker compose up -d frontend
```

### 4. Validar o deploy

Aguarde ~30s após o `up -d` e verifique:

```bash
# Status dos containers
docker compose ps

# Health check do backend
curl -f http://localhost:4000/health || echo "BACKEND FORA"

# Logs recentes (procure por erros de startup)
docker compose logs --tail=50 backend
docker compose logs --tail=50 frontend
```

**Sinais de sucesso no backend:**
- `Server listening at http://0.0.0.0:4000`
- `Scheduler initialized`
- Sem `Error` ou `FATAL` nas últimas linhas

**Sinais de sucesso no frontend:**
- Container status `Up`
- Sem `Module not found` ou erros de build

### 5. Se algo falhar

**Container não sobe:**
```bash
docker compose logs backend   # leia o erro completo
docker compose logs frontend
```

**Erro de variável de ambiente faltando:**
```bash
docker compose config   # mostra o compose resolvido com as envs
```

**Build falhou por cache corrompido:**
```bash
docker compose build --no-cache --pull backend
```

**Redis não responde:**
```bash
docker compose restart redis
docker compose up -d backend  # reinicia backend após redis
```

---

## Comandos úteis do dia a dia

```bash
# Ver logs em tempo real
docker compose logs -f backend
docker compose logs -f frontend

# Restart de um serviço sem rebuild
docker compose restart backend

# Ver uso de recursos
docker stats

# Entrar no container para debug
docker compose exec backend sh
docker compose exec frontend sh

# Ver variáveis de ambiente do container
docker compose exec backend env
```

---

## Checklist antes de ir para produção

- [ ] Código commitado e pushed para a branch correta
- [ ] Migrations novas foram rodadas no Supabase
- [ ] Variáveis de ambiente no `.env` da VPS estão atualizadas
- [ ] Testou localmente antes (ou revisou o diff com cuidado)
- [ ] Tem como reverter: anote o commit anterior com `git log --oneline -5`
