# FlowAds — Gestor de Tráfego Inteligente

Plataforma para gestores de tráfego pago automatizarem campanhas de Meta Ads usando um construtor visual de automações por blocos.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS + React Flow |
| Backend | Node.js + Fastify + TypeScript |
| Fila de jobs | BullMQ + Redis |
| Banco de dados | Supabase (PostgreSQL + Auth + Storage) |
| Deploy | Docker Compose |

## Pré-requisitos

- Docker e Docker Compose instalados
- Conta no [Supabase](https://supabase.com) (gratuito para começar)
- Node.js 20+ (para desenvolvimento local)

## Setup Rápido (Docker)

### 1. Clone e configure o ambiente

```bash
git clone <repo>
cd flowads
cp .env.example .env
```

Edite o `.env` com suas credenciais (mínimo obrigatório: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `ENCRYPTION_KEY`).

### 2. Configure o banco de dados (Supabase)

No dashboard do Supabase, vá em **SQL Editor** e execute as migrations em ordem:

```sql
-- 1. Execute o conteúdo de:
supabase/migrations/001_initial_schema.sql

-- 2. Execute:
supabase/migrations/002_rls_policies.sql

-- 3. Execute (seed com presets e dados demo):
supabase/migrations/003_seed_presets.sql
```

### 3. Crie o primeiro usuário admin

No Supabase Dashboard > Authentication > Users > **Invite user**:
- Email: seu@email.com
- Senha: definida pelo usuário

Em seguida, no SQL Editor, registre o usuário na tabela `users`:

```sql
INSERT INTO users (email, name, role)
VALUES ('seu@email.com', 'Seu Nome', 'admin');
```

### 4. Suba com Docker Compose

```bash
docker compose up -d
```

Acesse:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Health check**: http://localhost:4000/health

## Desenvolvimento Local

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

### Redis (necessário para o scheduler)

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

## Variáveis de Ambiente

Veja o arquivo [.env.example](.env.example) com todas as variáveis necessárias e suas descrições.

### Variáveis obrigatórias

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública do Supabase |
| `SUPABASE_SERVICE_KEY` | Chave de serviço do Supabase (backend) |
| `ENCRYPTION_KEY` | Chave de 32 chars para criptografia |

### Variáveis opcionais (configuráveis via UI)

- `META_TOKEN` — Token Meta API (por cliente ou global)
- `WHATSAPP_API_URL` + `WHATSAPP_TOKEN` — WhatsApp (Evolution API ou Z-API)
- `OPENAI_API_KEY` — OpenAI
- `ANTHROPIC_API_KEY` — Anthropic / Claude

## Funcionalidades

### Builder de Automações
- 40+ blocos em 8 categorias (Triggers, Meta Ads, Agentes IA, WhatsApp, Notion, Google Drive, Lógica, Utilitários)
- Drag & drop visual com React Flow
- Auto-layout com dagre
- Sistema de variáveis `{{cliente.nome}}`, `{{metricas.ctr}}`, etc.
- Autocomplete de variáveis ao digitar `{{`
- Auto-save com debounce de 2 segundos

### Agentes de IA
- Suporte a GPT-4o, o1, o3-mini (OpenAI)
- Suporte a Claude Sonnet/Opus/Haiku (Anthropic)
- System prompt + Human message com variáveis
- Saída em texto livre ou JSON com schema validado
- Memória de conversa opcional

### Integrações
- **Meta Ads**: buscar métricas, criar/editar/pausar anúncios, ajustar orçamento
- **WhatsApp**: envio de mensagens e arquivos (Evolution API / Z-API)
- **Notion**: criar/buscar/atualizar páginas
- **Google Drive**: listar/baixar/fazer upload de arquivos
- **HTTP**: chamadas para qualquer API REST

### Presets
8 automações prontas para usar:
1. Relatório Semanal WhatsApp
2. Sincronizar Posts Instagram
3. Alerta de Performance
4. Criativo do Drive
5. Criativo do Notion
6. Relatório Mensal Completo
7. Pausar anúncios com baixo CTR
8. Gerar copy com IA

## Estrutura do Projeto

```
flowads/
├── frontend/          # Next.js 14 App Router
│   ├── app/           # Páginas (login, dashboard, clients, builder...)
│   ├── components/    # Componentes (UI, layout, builder, clients, agents)
│   ├── lib/           # API client, utils, block catalog
│   └── hooks/         # Custom hooks
├── backend/           # Fastify API
│   └── src/
│       ├── routes/    # Endpoints REST
│       ├── services/  # Meta, OpenAI, Anthropic, WhatsApp
│       ├── jobs/      # BullMQ scheduler + executor
│       └── lib/       # Supabase client, types
├── supabase/
│   └── migrations/    # SQL migrations
├── docker-compose.yml
└── .env.example
```

## Segurança

- Tokens de API nunca expostos no frontend — toda comunicação passa pelo backend
- API keys mascaradas na UI (mostra apenas últimos 4 caracteres)
- Row Level Security (RLS) habilitado em todas as tabelas
- Middleware Next.js protege todas as rotas autenticadas
- Sem cadastro público — admin cria usuários via Supabase Auth Admin

## Suporte

Para reportar bugs ou solicitar funcionalidades, abra uma issue no repositório.
