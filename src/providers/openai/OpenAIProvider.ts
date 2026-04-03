// OpenAI Provider 实现

import OpenAI from 'openai'
import type { ModelInfo, ChatMessage, ChatOptions, ChatChunk, ChatResponse, ProviderConfig } from '../base/Provider.js'
import { BaseProvider } from '../base/Provider.js'

export class OpenAIProvider extends BaseProvider {
  readonly providerName = 'openai'
  private client: OpenAI | null = null
  
  private models: ModelInfo[] = [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, maxOutputTokens: 16384, capabilities: { vision: true, tools: true, thinking: false, streaming: true }, pricing: { inputPer1M: 5, outputPer1M: 15 }},
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000, maxOutputTokens: 16384, capabilities: { vision: true, tools: true, thinking: false, streaming: true }, pricing: { inputPer1M: 0.15, outputPer1M: 0.6 }},
    { id: 'o1-preview', name: 'O1 Preview', provider: 'openai', contextWindow: 128000, maxOutputTokens: 32768, capabilities: { vision: false, tools: false, thinking: true, streaming: false }, pricing: { inputPer1M: 15, outputPer1M: 60 }}
  ]
  
  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl, maxRetries: config.maxRetries ?? 3, timeout: config.timeout ?? 600000 })
  }
  
  destroy(): void { this.client = null }
  listModels(): ModelInfo[] { return this.models }
  getModel(id: string): ModelInfo | null { return this.models.find(m => m.id === id) ?? null }
  isModelAvailable(id: string): boolean { return this.models.some(m => m.id === id) }
  
  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    if (!this.client) throw new Error('Provider not initialized')
    
    const convertedMessages = messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: m.toolUseId ?? '',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        }
      }
      if (m.role === 'system') {
        return { role: 'system' as const, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }
      }
      if (m.role === 'assistant') {
        const base: Record<string, unknown> = { role: 'assistant', content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }
        if (m.toolCalls) {
          base.tool_calls = m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.input) }
          }))
        }
        return base
      }
      return { role: 'user' as const, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }
    })
    
    const msg = await this.client.chat.completions.create({
      model: options.model,
      messages: convertedMessages as any[],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
      stop: options.stopSequences,
      stream: false
    })
    
    const choice = msg.choices[0]
    const finishReasonMap: Record<string, 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use'> = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'tool_calls': 'tool_use',
      'content_filter': 'stop_sequence',
      'function_call': 'tool_use'
    }
    
    return {
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls?.map(tc => ({ id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments) })),
      usage: { inputTokens: msg.usage?.prompt_tokens ?? 0, outputTokens: msg.usage?.completion_tokens ?? 0 },
      finishReason: finishReasonMap[choice.finish_reason] ?? 'end_turn',
      model: options.model
    }
  }
  
  async *chatStream(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<ChatChunk> {
    if (!this.client) throw new Error('Provider not initialized')
    
    const convertedMessages = messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: m.toolUseId ?? '',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        }
      }
      if (m.role === 'system') {
        return { role: 'system' as const, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }
      }
      if (m.role === 'assistant') {
        const base: Record<string, unknown> = { role: 'assistant', content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }
        if (m.toolCalls) {
          base.tool_calls = m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.input) }
          }))
        }
        return base
      }
      return { role: 'user' as const, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }
    })
    
    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: convertedMessages as any[],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true
    })
    
    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      if (choice.delta.content) yield { type: 'content', content: choice.delta.content }
      if (choice.delta.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          yield { type: 'tool_use', id: tc.id ?? '', name: tc.function?.name ?? '', input: tc.function?.arguments ?? '' }
        }
      }
      if (choice.finish_reason) yield { type: 'message_stop' }
    }
  }
}
