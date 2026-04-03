import { describe, it, expect, beforeEach } from 'vitest'
import { TokenEstimator } from '../TokenEstimator.js'
import type { ChatMessage } from '../../providers/base/types.js'

describe('TokenEstimator', () => {
  let estimator: TokenEstimator

  beforeEach(() => {
    estimator = new TokenEstimator()
  })

  describe('estimateMessageTokens', () => {
    it('estimates simple text message', () => {
      const msg: ChatMessage = { role: 'user', content: 'Hello world' }
      const tokens = estimator.estimateMessageTokens(msg)
      expect(tokens).toBeGreaterThan(0)
    })

    it('estimates longer text', () => {
      const content = 'a'.repeat(400)
      const msg: ChatMessage = { role: 'user', content }
      const tokens = estimator.estimateMessageTokens(msg)
      expect(tokens).toBeGreaterThanOrEqual(80)
      expect(tokens).toBeLessThanOrEqual(120)
    })

    it('estimates message with tool calls', () => {
      const msg: ChatMessage = {
        role: 'assistant',
        content: 'Let me read the file',
        toolCalls: [{ id: 'tc1', name: 'Read', input: { path: '/test.txt' } }]
      }
      const tokens = estimator.estimateMessageTokens(msg)
      expect(tokens).toBeGreaterThan(50)
    })

    it('estimates content blocks', () => {
      const msg: ChatMessage = {
        role: 'user',
        content: [{ type: 'text', text: 'Hello from block' }]
      }
      const tokens = estimator.estimateMessageTokens(msg)
      expect(tokens).toBeGreaterThan(0)
    })

    it('estimates image blocks at ~1000 tokens', () => {
      const msg: ChatMessage = {
        role: 'user',
        content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'base64data' } }]
      }
      const tokens = estimator.estimateMessageTokens(msg)
      expect(tokens).toBe(1000)
    })
  })

  describe('estimateMessages', () => {
    it('estimates multiple messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' }
      ]
      const estimate = estimator.estimateMessages(messages)
      expect(estimate.total).toBeGreaterThan(0)
      expect(estimate.messages).toHaveLength(3)
      expect(estimate.byType['user']).toBeGreaterThan(0)
      expect(estimate.byType['assistant']).toBeGreaterThan(0)
    })

    it('returns zero for empty array', () => {
      const estimate = estimator.estimateMessages([])
      expect(estimate.total).toBe(0)
      expect(estimate.messages).toHaveLength(0)
    })
  })

  describe('estimateTextTokens', () => {
    it('estimates text tokens', () => {
      const tokens = estimator.estimateTextTokens('Hello world')
      expect(tokens).toBe(3)
    })

    it('handles empty string', () => {
      expect(estimator.estimateTextTokens('')).toBe(0)
    })
  })

  describe('getContextUsage', () => {
    it('returns usage info', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]
      const usage = estimator.getContextUsage(messages, 100000)
      expect(usage.used).toBeGreaterThan(0)
      expect(usage.remaining).toBeLessThan(100000)
      expect(usage.percentage).toBeGreaterThan(0)
      expect(usage.percentage).toBeLessThan(1)
    })

    it('isAboveThreshold works', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'a'.repeat(4000) }]
      const usage = estimator.getContextUsage(messages, 10000)
      expect(usage.isAboveThreshold(500)).toBe(true)
      expect(usage.isAboveThreshold(10000)).toBe(false)
    })

    it('handles full context', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'a'.repeat(400000) }]
      const usage = estimator.getContextUsage(messages, 100000)
      expect(usage.remaining).toBe(0)
      expect(usage.percentage).toBeGreaterThanOrEqual(1)
    })
  })
})
