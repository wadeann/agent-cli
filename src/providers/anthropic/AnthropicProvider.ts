// Anthropic Provider 实现

import Anthropic from '@anthropic-ai/sdk'
import type { ModelInfo, ChatMessage, ChatOptions, ChatChunk, ChatResponse, ProviderConfig } from '../base/Provider.js'
import { BaseProvider } from '../base/Provider.js'

type AnthropicMessageParam = {
  role: 'user' | 'assistant'
  content: string | Array<{ type: 'tool_result'; tool_use_id: string; content: string }>
}

export class AnthropicProvider extends BaseProvider {
  readonly providerName = 'anthropic'
  private client: Anthropic | null = null
  
  private models: ModelInfo[] = [
    { id: 'claude-opus-4-5-20251120', name: 'Claude Opus 4.5', provider: 'anthropic', contextWindow: 200000, maxOutputTokens: 8192, capabilities: { vision: true, tools: true, thinking: true, streaming: true }, pricing: { inputPer1M: 15, outputPer1M: 75 }},
    { id: 'claude-sonnet-4-5-20251120', name: 'Claude Sonnet 4.5', provider: 'anthropic', contextWindow: 200000, maxOutputTokens: 8192, capabilities: { vision: true, tools: true, thinking: true, streaming: true }, pricing: { inputPer1M: 3, outputPer1M: 15 }},
    { id: 'claude-haiku-3-5-20250520', name: 'Claude Haiku 3.5', provider: 'anthropic', contextWindow: 200000, maxOutputTokens: 8192, capabilities: { vision: true, tools: true, thinking: false, streaming: true }, pricing: { inputPer1M: 0.8, outputPer1M: 4 }}
  ]
  
  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 600000,
    })
  }
  
  destroy(): void { this.client = null }
  
  listModels(): ModelInfo[] { return this.models }
  getModel(id: string): ModelInfo | null { return this.models.find(m => m.id === id) ?? null }
  isModelAvailable(id: string): boolean { return this.models.some(m => m.id === id) }
  
  private convertMessages(messages: ChatMessage[]): AnthropicMessageParam[] {
    return messages
      .filter(m => m.role !== 'system')
      .map((m): AnthropicMessageParam => {
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: m.toolUseId ?? '',
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
              }
            ]
          }
        }
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        }
      })
  }
  
  private getSystemText(messages: ChatMessage[], options: ChatOptions): string | undefined {
    const systemPrompt = options.systemPrompt ?? messages.find(m => m.role === 'system')?.content
    return typeof systemPrompt === 'string' ? systemPrompt : undefined
  }
  
  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    if (!this.client) throw new Error('Provider not initialized')
    
    const msg = await this.client.messages.create({
      model: options.model,
      messages: this.convertMessages(messages),
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature,
      top_p: options.topP,
      system: this.getSystemText(messages, options),
      stop_sequences: options.stopSequences,
      stream: false
    })
    
    return {
      content: msg.content[0]?.type === 'text' ? msg.content[0].text : '',
      toolCalls: msg.content.filter((c: any) => c.type === 'tool_use').map((c: any) => ({ id: c.id, name: c.name, input: c.input })),
      usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
      finishReason: msg.stop_reason === 'max_tokens' ? 'max_tokens' : msg.stop_reason === 'end_turn' ? 'end_turn' : 'stop_sequence',
      model: options.model
    }
  }
  
  async *chatStream(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<ChatChunk> {
    if (!this.client) throw new Error('Provider not initialized')
    
    const stream = await this.client.messages.create({
      model: options.model,
      messages: this.convertMessages(messages),
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature,
      top_p: options.topP,
      system: this.getSystemText(messages, options),
      stream: true
    })
    
    let currentToolId: string | undefined
    let currentToolName: string | undefined
    let currentToolInput = ''
    
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
        currentToolId = chunk.content_block.id
        currentToolName = chunk.content_block.name
        currentToolInput = ''
      } else if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          yield { type: 'content', content: chunk.delta.text }
        } else if (chunk.delta.type === 'input_json_delta') {
          currentToolInput += chunk.delta.partial_json ?? ''
          yield { 
            type: 'tool_use', 
            id: currentToolId ?? '', 
            name: currentToolName ?? '', 
            input: currentToolInput 
          }
        }
      } else if (chunk.type === 'message_stop') {
        yield { type: 'message_stop' }
      }
    }
  }
}
