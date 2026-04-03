// Provider工厂 - 统一创建和管理Provider实例

import type { Provider, ProviderConfig } from '../base/Provider.js'
import { AnthropicProvider } from '../anthropic/AnthropicProvider.js'
import { OpenAIProvider } from '../openai/OpenAIProvider.js'

export type ProviderType = 'anthropic' | 'openai' | 'google' | 'ollama' | 'custom'

export interface ProviderEntry {
  type: ProviderType
  instance: Provider
  config: ProviderConfig
}

export class ProviderFactory {
  private providers: Map<string, ProviderEntry> = new Map()
  
  register(name: string, type: ProviderType, instance: Provider, config: ProviderConfig): void {
    this.providers.set(name, { type, instance, config })
  }
  
  async create(name: string, type: ProviderType, config: ProviderConfig): Promise<Provider> {
    const provider = this.createProvider(type, config)
    await provider.initialize(config)
    this.register(name, type, provider, config)
    return provider
  }
  
  createProvider(type: ProviderType, _config: ProviderConfig): Provider {
    switch (type) {
      case 'anthropic': return new AnthropicProvider()
      case 'openai': return new OpenAIProvider()
      case 'google': throw new Error('Google not implemented')
      case 'ollama': throw new Error('Ollama not implemented')
      case 'custom': throw new Error('Custom not implemented')
      default: throw new Error(`Unknown: ${type}`)
    }
  }
  
  get(name: string): Provider | null {
    return this.providers.get(name)?.instance ?? null
  }
  
  list(): string[] {
    return Array.from(this.providers.keys())
  }
  
  async remove(name: string): Promise<void> {
    const entry = this.providers.get(name)
    if (entry) { entry.instance.destroy(); this.providers.delete(name) }
  }
  
  async destroyAll(): Promise<void> {
    for (const e of this.providers.values()) e.instance.destroy()
    this.providers.clear()
  }
}

let factory: ProviderFactory | null = null
export function getGlobalFactory(): ProviderFactory {
  if (!factory) factory = new ProviderFactory()
  return factory
}
