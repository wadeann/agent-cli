// Performance Regression Tests - Track benchmarks over time

import { describe, it, expect } from 'vitest'
import { MemoryManager } from '../../src/memory/MemoryManager.js'
import { TokenEstimator } from '../../src/compaction/TokenEstimator.js'
import { CompactionEngine } from '../../src/compaction/CompactionEngine.js'
import { LRUCache, MessageDeduplicator, PerformanceMetrics } from '../../src/optimization/PerformanceOptimizer.js'
import { CircuitBreaker } from '../../src/harness/blocking/CircuitBreaker.js'
import { SubprocessManager } from '../../src/harness/blocking/SubprocessManager.js'
import { MessageBus } from '../../src/agents/MessageBus.js'
import { AgentCoordinator } from '../../src/agents/AgentCoordinator.js'
import { SecurityValidator } from '../../src/security/SecurityValidator.js'
import { SessionManager } from '../../src/cli/SessionManager.js'
import { PluginMarketplace } from '../../plugins/marketplace.js'
import type { ChatMessage } from '../../src/providers/base/types.js'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { join, tmpdir } from 'path'
import { tmpdir as osTmpdir } from 'os'

// Performance thresholds (generous for CI environments)
const THRESHOLDS = {
  memorySearch1000: 100,
  memorySearch5000: 500,
  tokenEstimate10000: 200,
  compaction1000: 100,
  lruCache100k: 2000,
  dedup10k: 100,
  circuitBreaker100: 50,
  messageBus1000: 100,
  securityValidate10k: 50,
  sessionManager100: 100,
  marketplaceSearch: 10
}

function measure(fn: () => void): number {
  const start = performance.now()
  fn()
  return performance.now() - start
}

describe('Performance Regression: Memory', () => {
  it('searches 1000 entries within threshold', () => {
    const manager = new MemoryManager()
    for (let i = 0; i < 1000; i++) {
      manager.addEntry('project', `Task ${i}`, `Description ${i} with keywords`)
    }
    const duration = measure(() => manager.search('keywords'))
    expect(duration).toBeLessThan(THRESHOLDS.memorySearch1000)
  })

  it('searches 5000 entries within threshold', () => {
    const manager = new MemoryManager()
    for (let i = 0; i < 5000; i++) {
      manager.addEntry('project', `Item ${i}`, `Content ${i} with various keywords`)
    }
    const duration = measure(() => manager.search('keywords'))
    expect(duration).toBeLessThan(THRESHOLDS.memorySearch5000)
  })
})

describe('Performance Regression: Token Estimation', () => {
  it('estimates 10000 messages within threshold', () => {
    const estimator = new TokenEstimator()
    const messages: ChatMessage[] = Array.from({ length: 10000 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant' as const,
      content: `Message ${i}: ${'a'.repeat(100)}`
    }))
    const duration = measure(() => estimator.estimateMessages(messages))
    expect(duration).toBeLessThan(THRESHOLDS.tokenEstimate10000)
  })
})

describe('Performance Regression: Compaction', () => {
  it('compacts 1000 messages within threshold', () => {
    const engine = new CompactionEngine()
    const messages: ChatMessage[] = Array.from({ length: 1000 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant' as const,
      content: `Message ${i}: ${'a'.repeat(100)}`
    }))
    const duration = measure(() => engine.compactWithSummary(messages, 'Summary', 200000))
    expect(duration).toBeLessThan(THRESHOLDS.compaction1000)
  })
})

describe('Performance Regression: LRU Cache', () => {
  it('performs 100k get/set within threshold', () => {
    const cache = new LRUCache<string, number>(10000)
    const duration = measure(() => {
      for (let i = 0; i < 50000; i++) cache.set(`key-${i}`, i)
      for (let i = 0; i < 50000; i++) cache.get(`key-${i}`)
    })
    expect(duration).toBeLessThan(THRESHOLDS.lruCache100k)
  })
})

describe('Performance Regression: Deduplication', () => {
  it('checks 10k duplicates within threshold', () => {
    const dedup = new MessageDeduplicator(10000)
    const duration = measure(() => {
      for (let i = 0; i < 10000; i++) {
        dedup.isDuplicate({ role: 'tool', content: `result ${i}` })
      }
    })
    expect(duration).toBeLessThan(THRESHOLDS.dedup10k)
  })
})

describe('Performance Regression: Circuit Breaker', () => {
  it('records 100 steps within threshold', () => {
    const breaker = new CircuitBreaker({ maxSteps: 200 })
    const duration = measure(() => {
      for (let i = 0; i < 100; i++) breaker.recordStep(`step-${i}`)
    })
    expect(duration).toBeLessThan(THRESHOLDS.circuitBreaker100)
  })
})

describe('Performance Regression: Message Bus', () => {
  it('sends 1000 messages within threshold', () => {
    const bus = new MessageBus(2000)
    const handler = () => {}
    bus.subscribe('agent', handler)
    const duration = measure(() => {
      for (let i = 0; i < 1000; i++) {
        bus.send({ from: 'sender', to: 'agent', type: 'task', content: `msg-${i}` })
      }
    })
    expect(duration).toBeLessThan(THRESHOLDS.messageBus1000)
  })
})

describe('Performance Regression: Security', () => {
  it('validates 10k inputs within threshold', () => {
    const validator = new SecurityValidator()
    const duration = measure(() => {
      for (let i = 0; i < 10000; i++) {
        validator.validateInput(`Normal input ${i}`)
      }
    })
    expect(duration).toBeLessThan(THRESHOLDS.securityValidate10k)
  })
})

describe('Performance Regression: Session Manager', () => {
  it('manages 100 sessions within threshold', async () => {
    const sessionsDir = mkdtempSync(join(osTmpdir(), `regression-sessions-`))
    const manager = new SessionManager({ sessionsDir, maxSessions: 200 })
    await manager.initialize()
    const duration = measure(() => {
      for (let i = 0; i < 100; i++) {
        const session = manager.createSession(`Session ${i}`)
        manager.addMessage('user', `Message ${i}`)
      }
    })
    expect(duration).toBeLessThan(THRESHOLDS.sessionManager100)
    if (existsSync(sessionsDir)) rmSync(sessionsDir, { recursive: true, force: true })
  })
})

describe('Performance Regression: Plugin Marketplace', () => {
  it('searches marketplace within threshold', () => {
    const marketplace = new PluginMarketplace()
    const duration = measure(() => marketplace.search('helper'))
    expect(duration).toBeLessThan(THRESHOLDS.marketplaceSearch)
  })
})

describe('Performance Regression: Memory Usage', () => {
  it('MemoryManager handles 10k entries with eviction', () => {
    const manager = new MemoryManager({
      maxEntriesPerLayer: { user: 50, feedback: 50, project: 10000, reference: 50 }
    })
    for (let i = 0; i < 10000; i++) {
      manager.addEntry('project', `Task ${i}`, `Content ${i}`)
    }
    expect(manager.getStats().project).toBe(10000)
  })

  it('LRUCache respects size limits', () => {
    const cache = new LRUCache<string, number>(100)
    for (let i = 0; i < 1000; i++) cache.set(`key-${i}`, i)
    expect(cache.size).toBeLessThanOrEqual(100)
  })

  it('MessageBus respects history limits', () => {
    const bus = new MessageBus(50)
    for (let i = 0; i < 100; i++) {
      bus.send({ from: 'a', to: 'b', type: 'task', content: `msg-${i}` })
    }
    expect(bus.getMessageCount()).toBeLessThanOrEqual(50)
  })
})
