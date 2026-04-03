import { describe, it, expect } from 'vitest'
import { MemoryManager } from '../../src/memory/MemoryManager.js'
import { TokenEstimator } from '../../src/compaction/TokenEstimator.js'
import { CompactionEngine } from '../../src/compaction/CompactionEngine.js'
import { LRUCache, MessageDeduplicator, PerformanceMetrics } from '../../src/optimization/PerformanceOptimizer.js'
import type { ChatMessage } from '../../src/providers/base/types.js'

function measure(fn: () => void): { duration: number; result: void } {
  const start = performance.now()
  const result = fn()
  return { duration: performance.now() - start, result }
}

async function measureAsync(fn: () => Promise<void>): Promise<{ duration: number }> {
  const start = performance.now()
  await fn()
  return { duration: performance.now() - start }
}

describe('Performance: Memory Search', () => {
  it('searches 1000 entries under 50ms', () => {
    const manager = new MemoryManager()
    for (let i = 0; i < 1000; i++) {
      manager.addEntry('project', `Task ${i}`, `Description for task ${i} with keywords: build, test, deploy, optimize, refactor`, { tags: ['task', `tag-${i % 10}`] })
    }
    const { duration } = measure(() => manager.search('build optimize'))
    expect(duration).toBeLessThan(50)
  })

  it('searches 5000 entries under 200ms', () => {
    const manager = new MemoryManager()
    for (let i = 0; i < 5000; i++) {
      manager.addEntry('project', `Item ${i}`, `Content for item ${i} with various keywords and descriptions for testing search performance`, { tags: [`tag-${i % 20}`] })
    }
    const { duration } = measure(() => manager.search('testing performance'))
    expect(duration).toBeLessThan(200)
  })

  it('adds 1000 entries under 100ms', () => {
    const manager = new MemoryManager()
    const { duration } = measure(() => {
      for (let i = 0; i < 1000; i++) {
        manager.addEntry('project', `Task ${i}`, `Content ${i}`)
      }
    })
    expect(duration).toBeLessThan(100)
  })
})

describe('Performance: Token Estimation', () => {
  it('estimates 10000 messages under 100ms', () => {
    const estimator = new TokenEstimator()
    const messages: ChatMessage[] = []
    for (let i = 0; i < 10000; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}: ${'a'.repeat(100)}` })
    }
    const { duration } = measure(() => estimator.estimateMessages(messages))
    expect(duration).toBeLessThan(100)
  })

  it('estimates single message under 1ms', () => {
    const estimator = new TokenEstimator()
    const msg: ChatMessage = { role: 'user', content: 'Hello world, this is a test message' }
    const { duration } = measure(() => estimator.estimateMessageTokens(msg))
    expect(duration).toBeLessThan(1)
  })
})

describe('Performance: Compaction', () => {
  it('compacts 1000 messages under 50ms', () => {
    const engine = new CompactionEngine()
    const messages: ChatMessage[] = []
    for (let i = 0; i < 1000; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}: ${'a'.repeat(100)}` })
    }
    const { duration } = measure(() => engine.compactWithSummary(messages, 'Summary', 200000))
    expect(duration).toBeLessThan(50)
  })

  it('prunes 5000 messages under 100ms', () => {
    const engine = new CompactionEngine()
    const messages: ChatMessage[] = []
    for (let i = 0; i < 5000; i++) {
      messages.push({ role: 'tool', content: `result ${i}: ${'a'.repeat(100)}`, toolUseId: `t${i}` })
    }
    const { duration } = measure(() => engine.pruneHistory(messages, 100000, 0.5))
    expect(duration).toBeLessThan(100)
  })
})

describe('Performance: LRU Cache', () => {
  it('performs 100000 get/set operations under 1000ms', () => {
    const cache = new LRUCache<string, number>(10000)
    const { duration } = measure(() => {
      for (let i = 0; i < 50000; i++) {
        cache.set(`key-${i}`, i)
      }
      for (let i = 0; i < 50000; i++) {
        cache.get(`key-${i}`)
      }
    })
    expect(duration).toBeLessThan(1000)
  })
})

describe('Performance: Message Deduplicator', () => {
  it('checks 10000 duplicates under 50ms', () => {
    const dedup = new MessageDeduplicator(10000)
    const { duration } = measure(() => {
      for (let i = 0; i < 10000; i++) {
        dedup.isDuplicate({ role: 'tool', content: `result ${i}` })
      }
    })
    expect(duration).toBeLessThan(50)
  })
})

describe('Performance: PerformanceMetrics', () => {
  it('records 10000 timings under 100ms', () => {
    const metrics = new PerformanceMetrics()
    const { duration } = measure(() => {
      for (let i = 0; i < 10000; i++) {
        const stop = metrics.startTimer('op')
        stop()
      }
    })
    expect(duration).toBeLessThan(100)
  })
})
