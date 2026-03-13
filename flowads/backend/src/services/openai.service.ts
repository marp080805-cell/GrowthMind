import OpenAI from 'openai'

export interface AIRequest {
  model: string
  systemPrompt: string
  humanMessage: string
  temperature: number
  maxTokens: number
  outputFormat: 'text' | 'json'
  outputSchema?: Record<string, unknown>
  memory?: { role: 'user' | 'assistant'; content: string }[]
}

export interface AIResponse {
  content: string
  parsed?: unknown
}

export class OpenAIService {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt })
    }

    if (req.memory) {
      messages.push(...req.memory.map((m) => ({ role: m.role, content: m.content } as OpenAI.Chat.Completions.ChatCompletionMessageParam)))
    }

    if (req.humanMessage) {
      messages.push({ role: 'user', content: req.humanMessage })
    }

    const response = await this.client.chat.completions.create({
      model: req.model,
      messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      response_format: req.outputFormat === 'json' ? { type: 'json_object' } : { type: 'text' },
    })

    const content = response.choices[0]?.message?.content || ''

    if (req.outputFormat === 'json') {
      try {
        return { content, parsed: JSON.parse(content) }
      } catch {
        return { content }
      }
    }

    return { content }
  }
}
