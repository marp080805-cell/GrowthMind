---
name: flowads-new-block
description: >
  Cria um novo bloco de automação no AdMind. Use esta skill sempre que o usuário quiser adicionar
  um novo tipo de nó/bloco ao visual builder — seja uma integração nova, lógica customizada,
  ou ação nova (ex: "criar bloco de e-mail", "adicionar bloco de Slack", "novo bloco de planilha").
  Também deve ser usada quando o usuário pedir para "adicionar suporte a X nas automações" ou
  "quero um nó que faça Y". Deve ser ativada para qualquer pedido de extensão do catálogo de blocos.
---

# Criando um novo bloco no AdMind

Criar um bloco envolve **4 arquivos** obrigatórios e segue um padrão específico. Siga exatamente esta ordem.

## Arquivos envolvidos

```
frontend/lib/blocks.ts                         → Cadastrar no catálogo
frontend/components/builder/inspectors/<nome>-inspector.tsx  → UI de configuração
backend/src/jobs/executor.ts                   → Lógica de execução
backend/src/services/<nome>.service.ts         → (opcional) serviço de integração
```

---

## Passo 1 — Entender o bloco

Antes de escrever código, responda:
- **Categoria**: meta | ai | whatsapp | notion | drive | logic | util (ou nova?)
- **Inputs**: quais dados o bloco recebe de nós anteriores?
- **Config**: quais campos o usuário configura no inspector?
- **Output**: o que o bloco produz para os nós seguintes?
- **Side effects**: faz chamada externa? escreve em banco? envia mensagem?

---

## Passo 2 — Cadastrar em `blocks.ts`

Leia o arquivo para entender os padrões existentes antes de editar.

```typescript
{
  type: 'minha_acao',           // snake_case, único
  label: 'Minha Ação',          // nome exibido na palette
  description: 'O que faz',     // descrição curta
  category: 'util',             // categoria existente ou nova
  icon: IconName,               // ícone Lucide existente no arquivo
  color: 'bg-gray-500',         // Tailwind bg color da categoria
  defaultConfig: {              // valores default do inspector
    campo: '',
  }
}
```

**Importante:** use ícones já importados no topo do arquivo. Não importe ícones novos sem verificar se já existem.

---

## Passo 3 — Criar o Inspector

Local: `frontend/components/builder/inspectors/<tipo>-inspector.tsx`

Leia 2-3 inspectors existentes antes de criar o novo para entender:
- Como receber e salvar `config` via `onChange`
- Como usar os componentes `ui/` (Input, Select, Textarea, Label)
- Como exibir variáveis disponíveis com `VariableAutocomplete`
- O padrão de props: `{ config: Record<string, any>, onChange: (config) => void }`

Registre o novo inspector em `inspector.tsx` no switch/map de tipos.

---

## Passo 4 — Implementar no Executor

Local: `backend/src/jobs/executor.ts`

Encontre o `switch(node.type)` ou o mapa de handlers. Adicione o novo case:

```typescript
case 'minha_acao': {
  // 1. Extraia config interpolado (variáveis já foram resolvidas)
  const { campo } = node.config;

  // 2. Execute a lógica
  const resultado = await fazAlgo(campo);

  // 3. Retorne output estruturado
  return { sucesso: true, dados: resultado };
}
```

**Padrões do executor:**
- Config já vem com variáveis interpoladas (`{{client.name}}` → valor real)
- Retorne sempre um objeto serializable como output
- Lance `Error` com mensagem clara em caso de falha — o executor captura e loga automaticamente
- Se precisar de cliente externo (API key, token), busque das settings via `getSettings()`

---

## Passo 5 — Criar Service (se necessário)

Se o bloco faz chamada a uma API externa, crie `backend/src/services/<nome>.service.ts`.

Padrão dos services existentes:
- Classe ou funções exportadas (sem estado)
- Recebe as credenciais como parâmetro (não lê .env diretamente — usa settings do banco)
- Trata erros da API e relança com mensagens legíveis
- Retorna dados estruturados, não o objeto bruto da API

---

## Passo 6 — Verificação

Antes de considerar pronto, confirme:

- [ ] Bloco aparece na palette com ícone e cor corretos
- [ ] Inspector abre e salva a config sem erros de TypeScript
- [ ] Executor tem o case para o novo `type`
- [ ] Variáveis `{{}}` funcionam nos campos de texto do inspector
- [ ] Output do bloco está documentado no `defaultConfig` ou no retorno do executor
- [ ] Não há imports quebrados

---

## Referência rápida de categorias e cores

| Categoria | Cor | Exemplos de blocos |
|---|---|---|
| meta | bg-blue-500 | fetch_metrics, pause_ad |
| ai | bg-purple-500 | agent |
| whatsapp | bg-green-500 | send_message |
| notion | bg-gray-700 | create_page |
| drive | bg-yellow-500 | upload_file |
| logic | bg-orange-500 | if, wait, filter |
| util | bg-gray-500 | http, log, format_text |
