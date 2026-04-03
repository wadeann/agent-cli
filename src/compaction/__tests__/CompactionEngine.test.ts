import { describe, it, expect, beforeEach } from 'vitest'
import { CompactionEngine } from '../CompactionEngine.js'
import type { ChatMessage } from '../../providers/base/types.js'

describe('CompactionEngine', () => {
  let engine: CompactionEngine

  beforeEach(() => {
    engine = new CompactionEngine()
  })

  function makeMessages(count: number, charsPerMessage = 400): ChatMessage[] {
    const messages: ChatMessage[] = []
    for (let i = 0; i < count; i++) {
      messages.push(
        { role: 'user', content: `Question ${i}: ${'a'.repeat(charsPerMessage)}` },
        { role: 'assistant', content: `Answer ${i}: ${'b'.repeat(charsPerMessage)}` }
      )
    }
    return messages
  }

  describe('shouldAutoCompact', () => {
    it('returns true when above threshold', () => {
      const messages = makeMessages(500, 2000)
      expect(engine.shouldAutoCompact(messages, 200000)).toBe(true)
    })

    it('returns false when below threshold', () => {
      const messages = makeMessages(5, 100)
      expect(engine.shouldAutoCompact(messages, 200000)).toBe(false)
    })

    it('returns false after max consecutive failures', () => {
      for (let i = 0; i < 3; i++) engine.recordFailure()
      const messages = makeMessages(500, 2000)
      expect(engine.shouldAutoCompact(messages, 200000)).toBe(false)
    })
  })

  describe('shouldWarn', () => {
    it('returns true when approaching limit', () => {
      const messages = makeMessages(500, 2000)
      expect(engine.shouldWarn(messages, 200000)).toBe(true)
    })

    it('returns false when well within limit', () => {
      const messages = makeMessages(3, 100)
      expect(engine.shouldWarn(messages, 200000)).toBe(false)
    })
  })

  describe('shouldBlock', () => {
    it('returns true when near context limit', () => {
      const messages = makeMessages(500, 2000)
      expect(engine.shouldBlock(messages, 200000)).toBe(true)
    })

    it('returns false when within manual compact buffer', () => {
      const messages = makeMessages(5, 100)
      expect(engine.shouldBlock(messages, 200000)).toBe(false)
    })
  })

  describe('microCompact', () => {
    it('returns same messages when not idle long enough', () => {
      const messages = makeMessages(10)
      const recentTime = Date.now() - 5 * 60 * 1000
      const result = engine.microCompact(messages, recentTime)
      expect(result).toEqual(messages)
    })

    it('clears old tool results when idle', () => {
      const messages: ChatMessage[] = [
        { role: 'tool', content: 'old result 1', toolUseId: 't1' },
        { role: 'tool', content: 'old result 2', toolUseId: 't2' },
        { role: 'tool', content: 'old result 3', toolUseId: 't3' },
        { role: 'tool', content: 'old result 4', toolUseId: 't4' },
        { role: 'tool', content: 'old result 5', toolUseId: 't5' },
        { role: 'tool', content: 'old result 6', toolUseId: 't6' },
        { role: 'user', content: 'recent question' }
      ]
      const oldTime = Date.now() - 120 * 60 * 1000
      const result = engine.microCompact(messages, oldTime)
      expect(result.length).toBe(messages.length)
    })
  })

  describe('pruneHistory', () => {
    it('prunes messages to fit target', () => {
      const messages: ChatMessage[] = []
      for (let i = 0; i < 50; i++) {
        messages.push({ role: 'tool', content: `result ${i}: ${'a'.repeat(400)}`, toolUseId: `t${i}` })
        messages.push({ role: 'assistant', content: `answer ${i}: ${'b'.repeat(400)}` })
      }
      const pruned = engine.pruneHistory(messages, 20000, 0.5)
      expect(pruned.length).toBeLessThan(messages.length)
    })

    it('returns original when already within budget', () => {
      const messages = makeMessages(3, 100)
      const pruned = engine.pruneHistory(messages, 200000, 0.5)
      expect(pruned).toEqual(messages)
    })

    it('keeps at least 2 messages', () => {
      const messages = makeMessages(5, 400)
      const pruned = engine.pruneHistory(messages, 1000, 0.5)
      expect(pruned.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('compactWithSummary', () => {
    it('compacts messages with summary', () => {
      const messages = makeMessages(20, 400)
      const result = engine.compactWithSummary(messages, 'Summary of conversation', 200000)
      expect(result.summary).toBe('Summary of conversation')
      expect(result.messagesKept.length).toBeLessThan(messages.length)
      expect(result.messagesKept[0].role).toBe('system')
      expect(result.tokensSaved).toBeGreaterThan(0)
      expect(result.method).toBe('full')
    })

    it('updates compaction state', () => {
      const messages = makeMessages(10, 400)
      engine.compactWithSummary(messages, 'Summary', 200000)
      const state = engine.getCompactionState()
      expect(state.compacted).toBe(true)
      expect(state.turnCounter).toBe(1)
      expect(state.consecutiveFailures).toBe(0)
    })
  })

  describe('compactWithSessionMemory', () => {
    it('uses session memory as context', () => {
      const messages = makeMessages(20, 400)
      const memoryContext = 'User prefers TypeScript. Project is a web app.'
      const result = engine.compactWithSessionMemory(messages, memoryContext, 200000)
      expect(result.summary).toBe(memoryContext)
      expect(result.method).toBe('session-memory')
      expect(result.tokensSaved).toBeGreaterThan(0)
    })

    it('falls back to prune when memory is too large', () => {
      const messages = makeMessages(20, 400)
      const largeMemory = 'a'.repeat(200000)
      const result = engine.compactWithSessionMemory(messages, largeMemory, 200000)
      expect(result.method).toBe('prune')
    })
  })

  describe('recordFailure', () => {
    it('increments consecutive failures', () => {
      engine.recordFailure()
      engine.recordFailure()
      expect(engine.getCompactionState().consecutiveFailures).toBe(2)
    })
  })

  describe('getCompactionState', () => {
    it('returns initial state', () => {
      const state = engine.getCompactionState()
      expect(state.compacted).toBe(false)
      expect(state.turnCounter).toBe(0)
      expect(state.consecutiveFailures).toBe(0)
    })
  })
})
