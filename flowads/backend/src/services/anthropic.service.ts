import Anthropic from '@anthropic-ai/sdk'
import type { AIRequest, AIResponse } from './openai.service'

export class AnthropicService {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    const messages: Anthropic.Messages.MessageParam[] = []

    if (req.memory) {
      messages.push(...req.memory.map((m) => ({ role: m.role, content: m.content })))
    }

    if (req.humanMessage) {
      messages.push({ role: 'user', content: req.humanMessage })
    } else {
      messages.push({ role: 'user', content: 'Execute a tarefa conforme o system prompt.' })
    }

    const response = await this.client.messages.create({
      model: req.model,
      system: req.systemPrompt || undefined,
      messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    })

    const content = response.content[0]?.type === 'text' ? response.content[0].text : ''

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
