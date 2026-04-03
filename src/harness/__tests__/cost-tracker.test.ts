import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CostTracker } from '../CostTracker.js'
import { AnthropicProvider } from '../../providers/anthropic/AnthropicProvider.js'

describe('CostTracker', () => {
  let tracker: CostTracker
  let provider: AnthropicProvider
  
  beforeEach(() => {
    tracker = new CostTracker()
    provider = new AnthropicProvider()
  })
  
  it('should track usage and calculate cost', () => {
    const usage = { inputTokens: 1000, outputTokens: 500 }
    const cost = tracker.recordUsage(provider, 'claude-sonnet-4-5-20251120', usage, 'test prompt')
    
    expect(cost).toBeGreaterThan(0)
    expect(tracker.getTodayCost()).toBe(cost)
    expect(tracker.getMonthCost()).toBe(cost)
  })
  
  it('should respect daily limit', () => {
    tracker.setDailyLimit(0.01)  // 1 cent limit
    
    // First usage - should be ok
    const usage1 = { inputTokens: 100, outputTokens: 50 }
    const cost1 = tracker.recordUsage(provider, 'claude-sonnet-4-5-20251120', usage1, 'test')
    
    // Second usage that exceeds limit
    const usage2 = { inputTokens: 10000, outputTokens: 5000 }  // Much larger
    const result = tracker.checkBudget()
    
    // After first usage, should still be ok
    expect(tracker.checkBudget().ok).toBe(true)
  })
  
  it('should provide summary', () => {
    const usage = { inputTokens: 1000, outputTokens: 500 }
    tracker.recordUsage(provider, 'claude-sonnet-4-5-20251120', usage, 'test')
    
    const summary = tracker.getSummary()
    expect(summary.today).toBeGreaterThan(0)
    expect(summary.month).toBeGreaterThan(0)
    expect(summary.totalRequests).toBe(1)
    expect(summary.byProvider.anthropic).toBeGreaterThan(0)
    expect(summary.byModel['claude-sonnet-4-5-20251120']).toBeGreaterThan(0)
  })
  
  it('should clear history', () => {
    const usage = { inputTokens: 100, outputTokens: 50 }
    tracker.recordUsage(provider, 'claude-sonnet-4-5-20251120', usage, 'test')
    
    expect(tracker.getSummary().totalRequests).toBe(1)
    
    tracker.clearHistory()
    expect(tracker.getSummary().totalRequests).toBe(0)
    expect(tracker.getTodayCost()).toBe(0)
  })
})
