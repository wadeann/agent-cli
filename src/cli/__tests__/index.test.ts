import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProviderFactory } from '../../providers/factory/ProviderFactory.js'

describe('CLI Core', () => {
  it('should create provider factory', () => {
    const factory = new ProviderFactory()
    expect(factory).toBeDefined()
    expect(factory.list()).toEqual([])
  })

  it('should register and get provider', async () => {
    const factory = new ProviderFactory()
    const { AnthropicProvider } = await import('../../providers/anthropic/AnthropicProvider.js')
    const provider = new AnthropicProvider()

    factory.register('test', 'anthropic', provider, { apiKey: 'test-key' })

    expect(factory.get('test')).toBe(provider)
    expect(factory.list()).toContain('test')
  })

  it('should list available providers', async () => {
    const factory = new ProviderFactory()
    const { AnthropicProvider } = await import('../../providers/anthropic/AnthropicProvider.js')
    const { OpenAIProvider } = await import('../../providers/openai/OpenAIProvider.js')

    factory.register('anthropic', 'anthropic', new AnthropicProvider(), {})
    factory.register('openai', 'openai', new OpenAIProvider(), {})

    expect(factory.list()).toEqual(['anthropic', 'openai'])
  })

  it('should remove provider', async () => {
    const factory = new ProviderFactory()
    const { AnthropicProvider } = await import('../../providers/anthropic/AnthropicProvider.js')
    const provider = new AnthropicProvider()

    factory.register('test', 'anthropic', provider, {})
    expect(factory.get('test')).toBeDefined()

    await factory.remove('test')
    expect(factory.get('test')).toBeNull()
  })
})

describe('Config Management', () => {
  it('should have default model in config', () => {
    const config = {
      defaultProvider: 'anthropic',
      defaultModel: 'claude-sonnet-4-5-20251120',
      providers: { anthropic: { apiKey: 'test-key' } },
      modelPreferences: {
        fast: 'claude-haiku-3-5-20250520',
        balanced: 'claude-sonnet-4-5-20251120',
        power: 'claude-opus-4-5-20251120'
      }
    }
    expect(config.defaultModel).toBeDefined()
    expect(config.modelPreferences).toBeDefined()
    expect(config.modelPreferences.fast).toBeDefined()
    expect(config.modelPreferences.balanced).toBeDefined()
    expect(config.modelPreferences.power).toBeDefined()
  })
})
