/**
 * Moderação de conteúdo para saídas de IA
 * Previne geração de conteúdo que viola políticas Meta
 */

// Palavras-chave proibidas (simplificado - em produção usar API como Perspective)
const PROHIBITED_KEYWORDS = new Set([
  // Ódio/discriminação
  'ódio', 'racismo', 'nazista', 'morte', 'matar', 'assassino', 'terrorista',
  // Drogas
  'cocaína', 'heroína', 'crack', 'metanfetamina', 'maconha', 'comprar droga', 'vender droga',
  // Sexual/nudez
  'pornô', 'porno', 'sexo explícito', 'nua', 'nudo', 'peitos', 'nus',
  // Fraude/esquemas
  'bitcoin grátis', 'ganhe dinheiro rápido', 'esquema', 'pirâmide', 'golpe', 'estafa',
  // Fake news
  'fake', 'falso', 'hoax', 'desinformação', 'mentira comprovada',
  // Conteúdo perigoso
  'bomba', 'explosivo', 'arma', 'tiro', 'bala', 'violência',
])

const SUSPICIOUS_PATTERNS = [
  // Ofertas muito boas para ser verdade
  /\b(grátis|free|100%|garantido|100% de retorno|sem risco)\b.*\b(dinheiro|ganhos|lucros|bitcoin|crypto)\b/i,
  // Click bait agressivo
  /^(clique|click|não perca|você não vai acreditar|shocking|incrível).{0,30}$/i,
  // Manipulação emocional extrema
  /(desesperado|suicida|morrer|morte|acabou|tudo perdido)/i,
]

interface ModerationResult {
  approved: boolean
  score: number  // 0-1, onde 1 é muito perigoso
  issues: string[]
  suggestedFix?: string
}

export function moderateContent(content: string): ModerationResult {
  /**
   * Analisa conteúdo gerado por IA e detecta possíveis violações
   * Retorna score de risco: 0 (seguro) a 1 (muito perigoso)
   */

  const issues: string[] = []
  let riskScore = 0

  const lowerContent = content.toLowerCase()

  // 1. Verificar palavras-chave proibidas
  for (const keyword of PROHIBITED_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      issues.push(`Contém palavra-chave proibida: "${keyword}"`)
      riskScore += 0.15
    }
  }

  // 2. Verificar padrões suspeitos
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(`Conteúdo suspeito de clickbait ou oferta enganosa`)
      riskScore += 0.20
    }
  }

  // 3. Verificar por caps excessivo (agressividade)
  const uppercaseCount = (content.match(/[A-Z]/g) || []).length
  const capsRatio = uppercaseCount / content.length
  if (capsRatio > 0.5) {
    issues.push(`Uso excessivo de MAIÚSCULAS (${Math.round(capsRatio * 100)}%) — muito agressivo`)
    riskScore += 0.10
  }

  // 4. Verificar exclamações e pontos de interrogação excessivos
  const punctuationCount = (content.match(/[!?]{2,}/g) || []).length
  if (punctuationCount > 3) {
    issues.push(`Pontuação excessiva (${punctuationCount} instâncias) — manipulação emocional`)
    riskScore += 0.10
  }

  // 5. Verificar comprimento anormalmente curto ou longo
  if (content.length < 10) {
    issues.push(`Conteúdo muito curto — parece incompleto`)
    riskScore += 0.05
  } else if (content.length > 5000) {
    issues.push(`Conteúdo muito longo para anúncio`)
    riskScore += 0.05
  }

  // Clampar score entre 0 e 1
  riskScore = Math.min(1, riskScore)

  return {
    approved: riskScore < 0.5,  // Aprovado se score < 0.5
    score: riskScore,
    issues: issues.length > 0 ? issues : ['Conteúdo parece seguro'],
    suggestedFix: issues.length > 0
      ? 'Revise o conteúdo antes de usar em anúncio'
      : undefined,
  }
}

export function shouldBlockAIOutput(moderationResult: ModerationResult): boolean {
  /**
   * Determina se saída da IA deve ser bloqueada
   * Bloqueia se:
   * - Score >= 0.7 (conteúdo perigoso)
   * - Contém 3+ issues
   */
  return moderationResult.score >= 0.7 || moderationResult.issues.length >= 3
}

export function formatModerationReport(result: ModerationResult): string {
  /**
   * Formata resultado de moderação em texto legível
   */
  return `
Moderação de Conteúdo
━━━━━━━━━━━━━━━━━━━
Status: ${result.approved ? '✅ Aprovado' : '⚠️ Rejeitado'}
Risco: ${(result.score * 100).toFixed(1)}%

Problemas encontrados:
${result.issues.map(issue => `  • ${issue}`).join('\n')}

${result.suggestedFix ? `Sugestão: ${result.suggestedFix}` : ''}
  `.trim()
}
