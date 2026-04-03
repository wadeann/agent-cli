import { describe, it, expect, beforeEach } from 'vitest'
import { OpenAIProvider } from '../openai/OpenAIProvider.js'

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider
  
  beforeEach(() => {
    provider = new OpenAIProvider()
  })
  
  it('should have correct provider name', () => {
    expect(provider.providerName).toBe('openai')
  })
  
  it('should list available models', () => {
    const models = provider.listModels()
    expect(models.length).toBeGreaterThan(0)
    expect(models[0].provider).toBe('openai')
  })
  
  it('should get model by id', () => {
    const model = provider.getModel('gpt-4o')
    expect(model).not.toBeNull()
    expect(model?.name).toBe('GPT-4o')
  })
  
  it('should check model availability', () => {
    expect(provider.isModelAvailable('gpt-4o')).toBe(true)
    expect(provider.isModelAvailable('unknown')).toBe(false)
  })
  
  it('should calculate cost correctly', () => {
    const usage = { inputTokens: 1000, outputTokens: 500 }
    const cost = provider.calculateCost(usage, 'gpt-4o')
    // GPT-4o: $5/1M input, $15/1M output
    expect(cost).toBeCloseTo(0.0125, 4)
  })
  
  it('should throw if not initialized', async () => {
    await expect(provider.chat([], { model: 'test' })).rejects.toThrow('not initialized')
  })
})
