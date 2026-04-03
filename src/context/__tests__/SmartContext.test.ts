import { describe, it, expect, beforeEach } from 'vitest'
import { SmartContextManager } from '../SmartContext.js'
import type { ChatMessage } from '../../providers/base/types.js'

describe('SmartContextManager', () => {
  let manager: SmartContextManager

  beforeEach(() => {
    manager = new SmartContextManager()
  })

  describe('buildContext', () => {
    it('builds context with all components', () => {
      const ctx = manager.buildContext({
        systemPrompt: 'You are a helpful assistant',
        messages: [{ role: 'user', content: 'Hello' }],
        memoryContext: 'User prefers TypeScript',
        toolResults: ['File read successfully']
      })
      expect(ctx.systemPrompt).toBe('You are a helpful assistant')
      expect(ctx.recentMessages).toHaveLength(1)
      expect(ctx.totalTokens).toBeGreaterThan(0)
    })

    it('truncates long system prompt', () => {
      const longPrompt = 'a'.repeat(50000)
      const ctx = manager.buildContext({
        systemPrompt: longPrompt,
        messages: []
      })
      expect(ctx.systemPrompt.length).toBeLessThan(longPrompt.length)
      expect(ctx.systemPrompt).toContain('truncated')
    })

    it('truncates long memory context', () => {
      const longMemory = 'a'.repeat(5000)
      const ctx = manager.buildContext({
        systemPrompt: 'test',
        messages: [],
        memoryContext: longMemory
      })
      expect(ctx.memoryContext.length).toBeLessThan(longMemory.length)
    })
  })

  describe('selectRelevantMessages', () => {
    it('prioritizes tool results', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'tool', content: 'Tool output' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Follow up' }
      ]
      const selected = manager.selectRelevantMessages(messages, 2)
      expect(selected).toHaveLength(2)
      // Tool result should be prioritized
      expect(selected.some(m => m.role === 'tool')).toBe(true)
    })

    it('prioritizes error messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'An error occurred: file not found' },
        { role: 'user', content: 'Normal message' }
      ]
      const selected = manager.selectRelevantMessages(messages, 2)
      expect(selected.some(m => m.content.includes('error'))).toBe(true)
    })

    it('respects maxMessages limit', () => {
      const messages: ChatMessage[] = Array.from({ length: 50 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i}`
      }))
      const selected = manager.selectRelevantMessages(messages, 10)
      expect(selected).toHaveLength(10)
    })
  })

  describe('selectRelevantCode', () => {
    it('selects most complex files', () => {
      const contexts = [
        { file: 'simple.ts', language: 'typescript', symbols: [], imports: [], complexity: 1 },
        { file: 'complex.ts', language: 'typescript', symbols: ['ClassA', 'ClassB'], imports: ['fs'], complexity: 10 },
        { file: 'medium.ts', language: 'typescript', symbols: ['fn'], imports: [], complexity: 5 }
      ]
      const selected = manager.selectRelevantCode(contexts, 2)
      expect(selected).toHaveLength(2)
      expect(selected[0].file).toBe('complex.ts')
      expect(selected[1].file).toBe('medium.ts')
    })
  })

  describe('selectRelevantToolResults', () => {
    it('returns last N results', () => {
      const results = ['result1', 'result2', 'result3', 'result4', 'result5']
      const selected = manager.selectRelevantToolResults(results, 2)
      expect(selected).toEqual(['result4', 'result5'])
    })
  })
})
