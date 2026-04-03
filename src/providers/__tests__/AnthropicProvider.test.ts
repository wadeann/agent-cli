import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AnthropicProvider } from '../anthropic/AnthropicProvider.js'

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider
  
  beforeEach(() => {
    provider = new AnthropicProvider()
  })
  
  it('should have correct provider name', () => {
    expect(provider.providerName).toBe('anthropic')
  })
  
  it('should list available models', () => {
    const models = provider.listModels()
    expect(models.length).toBeGreaterThan(0)
    expect(models[0].provider).toBe('anthropic')
  })
  
  it('should get model by id', () => {
    const model = provider.getModel('claude-sonnet-4-5-20251120')
    expect(model).not.toBeNull()
    expect(model?.name).toContain('Sonnet')
  })
  
  it('should check model availability', () => {
    expect(provider.isModelAvailable('claude-sonnet-4-5-20251120')).toBe(true)
    expect(provider.isModelAvailable('unknown-model')).toBe(false)
  })
  
  it('should calculate cost correctly', () => {
    const usage = { inputTokens: 1000, outputTokens: 500 }
    const cost = provider.calculateCost(usage, 'claude-sonnet-4-5-20251120')
    // Sonnet: $3/1M input, $15/1M output
    // Input: 0.001 * 3 = $0.003
    // Output: 0.0005 * 15 = $0.0075
    // Total: $0.0105
    expect(cost).toBeCloseTo(0.0105, 4)
  })
  
  it('should throw if not initialized', async () => {
    await expect(provider.chat([], { model: 'test' })).rejects.toThrow('not initialized')
  })
})
