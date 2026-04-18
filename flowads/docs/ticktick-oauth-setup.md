# TickTick OAuth — Como conectar

## Links essenciais

- **Portal do desenvolvedor (criar/gerenciar app):** https://developer.ticktick.com
- **Autorização OAuth:** https://ticktick.com/oauth/authorize
- **Token endpoint:** https://ticktick.com/oauth/token
- **API Tasks:** https://developer.ticktick.com/api

## Passo a passo para conectar

### 1. Criar o app no portal
1. Acesse https://developer.ticktick.com
2. Faça login com sua conta TickTick
3. Clique em **Create App** → dê um nome (ex: `AdMind`)
4. Anote o **Client ID** e **Client Secret**
5. Em **OAuth redirect URL**, coloque exatamente:
   ```
   https://admind.zi-ai.site/backend/ticktick/callback
   ```

### 2. Conectar no AdMind
1. Acesse **Configurações** no AdMind
2. Role até o card **TickTick**
3. Cole o **Client ID** e **Client Secret**
4. Clique em **Salvar tudo** (botão topo da página)
5. Clique em **Conectar com TickTick**
6. Autorize na janela que abrir
7. Pronto — token salvo automaticamente

## Como funciona

- Fluxo OAuth 2.0 padrão com `authorization_code`
- Backend: `GET /ticktick/connect` → redireciona para autorização
- Backend: `GET /ticktick/callback` → recebe code, troca por token, salva no banco
- Token expira em ~180 dias; use o botão **Renovar token** nas configurações ou chame `POST /ticktick/refresh`

## Escopos utilizados
```
tasks:write tasks:read
```

## Variáveis de saída do node `ticktick.create_task`
- `{{task_id}}` — ID da tarefa criada
- `{{task_url}}` — Link direto para a tarefa no TickTick Web

## Campos do node
| Campo | Descrição | Aceita variáveis |
|-------|-----------|-----------------|
| Título | Título da tarefa | Sim |
| Conteúdo | Corpo/descrição | Sim |
| Data de vencimento | Formato YYYY-MM-DD | Sim |
| ID do projeto | Deixe vazio para Inbox | Sim |
| Prioridade | Nenhuma / Baixa / Média / Alta | Não |

## Troubleshooting

**Token inválido após reconectar:**
- Verifique se o redirect URI no app TickTick é exatamente `https://admind.zi-ai.site/backend/ticktick/callback` (sem barra extra)

**"Client ID ou Client Secret não configurados":**
- Certifique-se de ter clicado em **Salvar tudo** antes de clicar em Conectar

**Token expirado:**
- Use o botão **Renovar token** nas configurações, ou reconecte pelo botão **Reconectar**
