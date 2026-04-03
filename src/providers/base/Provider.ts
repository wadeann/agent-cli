// Provider接口定义

import type { 
  ModelInfo, 
  ChatMessage, 
  ChatOptions, 
  ChatChunk, 
  ChatResponse,
  ProviderConfig,
  Usage 
} from './types.js'

export {
  ModelInfo,
  ChatMessage,
  ChatOptions,
  ChatChunk,
  ChatResponse,
  ProviderConfig,
  Usage
}

export interface Provider {
  readonly providerName: string
  
  initialize(config: ProviderConfig): Promise<void>
  destroy(): void
  
  // 模型管理
  listModels(): ModelInfo[]
  getModel(modelId: string): ModelInfo | null
  isModelAvailable(modelId: string): boolean
  
  // 对话接口
  chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse>
  chatStream(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<ChatChunk>
  
  // 计算成本
  calculateCost(usage: Usage, modelId: string): number
}

// 抽象基类
export abstract class BaseProvider implements Provider {
  abstract readonly providerName: string
  protected config: ProviderConfig | null = null
  
  abstract initialize(config: ProviderConfig): Promise<void>
  abstract destroy(): void
  abstract listModels(): ModelInfo[]
  abstract getModel(modelId: string): ModelInfo | null
  abstract isModelAvailable(modelId: string): boolean
  abstract chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse>
  abstract chatStream(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<ChatChunk>
  
  calculateCost(usage: Usage, modelId: string): number {
    const model = this.getModel(modelId)
    if (!model) return 0
    
    const inputCost = (usage.inputTokens / 1_000_000) * model.pricing.inputPer1M
    const outputCost = (usage.outputTokens / 1_000_000) * model.pricing.outputPer1M
    
    // 缓存折扣
    const cacheDiscount = 0.9
    const cacheCredits = ((usage.cacheCreationTokens ?? 0) + (usage.cacheReadTokens ?? 0)) / 1_000_000
    const cacheCost = cacheCredits * model.pricing.inputPer1M * cacheDiscount
    
    return inputCost + outputCost - cacheCost
  }
}
