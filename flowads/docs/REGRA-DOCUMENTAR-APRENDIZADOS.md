# Regra: Documentar Aprendizados Imediatamente

## A regra

**Aprendeu → Salvou. Sem exceção.**

Qualquer coisa descoberta durante o desenvolvimento — erro, comportamento da API, campo errado, limitação, solução, gotcha — deve ser documentada em um arquivo `.md` antes de seguir em frente.

---

## Quando criar ou atualizar um documento

- Descobriu que um campo da API não existe ou tem nome diferente → documenta
- Resolveu um erro que levou mais de 5 minutos → documenta
- Encontrou um comportamento inesperado de uma API externa → documenta
- Testou algo que não funcionou → documenta (o que tentou e por quê não funcionou)
- Encontrou a solução certa após tentativas → documenta (a solução E o que não funciona)
- Descobriu uma limitação de plataforma → documenta

---

## Onde salvar

```
flowads/docs/
├── meta-api-erros.md         # Códigos de erro, classificações, padrões
├── meta-api-creative.md      # Criação de criativos, CTAs, campos válidos
├── meta-api-filtro-posts.md  # Filtro de posts, detecção de duplicatas
└── ...                       # Criar novos arquivos por tema quando necessário
```

**Regra de organização:**
- Um arquivo por tema/domínio
- Se o arquivo cresce demais → divide em dois
- Nome descritivo: `{plataforma}-{tema}.md`

---

## Formato mínimo de um aprendizado

```markdown
## [O que foi descoberto]

**Contexto:** o que estava tentando fazer

**Problema:** o que aconteceu / o erro encontrado

**Causa:** por que aconteceu

**Solução:** o que resolveu

**O que NÃO funciona:** tentativas que falharam (evita repetir erros)
```

---

## Exemplos do que já foi aprendido e documentado

| Aprendizado | Arquivo |
|-------------|---------|
| `object_id` conflita com `source_instagram_media_id` e causa erro 1815279 | meta-api-creative.md |
| Campo correto é `eligible_to_boost`, não `boost_eligible` | meta-api-creative.md |
| CTA type correto para perfil Instagram é `VIEW_INSTAGRAM_PROFILE`, não `INSTAGRAM_PROFILE` | meta-api-creative.md |
| Erro 1815279 não é sobre música — é incompatibilidade técnica de vídeo | meta-api-erros.md |
| Erros 2061015/2446383 são de configuração de campanha, não restrição do post | meta-api-erros.md |

---

## Responsabilidade

Claude deve criar ou atualizar o documento relevante **na mesma sessão** em que o aprendizado ocorreu, preferencialmente logo após a descoberta — não no final da sessão.
