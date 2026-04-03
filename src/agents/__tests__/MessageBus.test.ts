import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MessageBus } from '../MessageBus.js'
import type { AgentMessage } from '../types.js'

describe('MessageBus', () => {
  let bus: MessageBus

  beforeEach(() => {
    bus = new MessageBus()
  })

  describe('send', () => {
    it('sends a message and delivers to recipient', () => {
      const handler = vi.fn()
      bus.subscribe('agent-a', handler)
      bus.send({ from: 'agent-b', to: 'agent-a', type: 'task', content: 'Do something' })
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].content).toBe('Do something')
    })

    it('generates unique IDs and timestamps', () => {
      const msg1 = bus.send({ from: 'a', to: 'b', type: 'task', content: 'x' })
      const msg2 = bus.send({ from: 'a', to: 'b', type: 'task', content: 'y' })
      expect(msg1.id).not.toBe(msg2.id)
      expect(msg2.timestamp).toBeGreaterThanOrEqual(msg1.timestamp)
    })

    it('stores messages in history', () => {
      bus.send({ from: 'a', to: 'b', type: 'task', content: 'x' })
      bus.send({ from: 'b', to: 'a', type: 'result', content: 'y' })
      expect(bus.getMessageCount()).toBe(2)
    })
  })

  describe('subscribe', () => {
    it('supports multiple handlers for same agent', () => {
      const h1 = vi.fn()
      const h2 = vi.fn()
      bus.subscribe('a', h1)
      bus.subscribe('a', h2)
      bus.send({ from: 'b', to: 'a', type: 'task', content: 'x' })
      expect(h1).toHaveBeenCalledTimes(1)
      expect(h2).toHaveBeenCalledTimes(1)
    })

    it('unsubscribe removes handler', () => {
      const handler = vi.fn()
      const unsub = bus.subscribe('a', handler)
      unsub()
      bus.send({ from: 'b', to: 'a', type: 'task', content: 'x' })
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('broadcast', () => {
    it('delivers broadcast messages to all subscribers', () => {
      const h1 = vi.fn()
      const h2 = vi.fn()
      bus.subscribe('a', h1)
      bus.subscribe('b', h2)
      bus.send({ from: 'coordinator', to: '*', type: 'broadcast', content: 'All agents' })
      expect(h1).toHaveBeenCalledTimes(1)
      expect(h2).toHaveBeenCalledTimes(1)
    })

    it('onBroadcast catches all broadcasts', () => {
      const handler = vi.fn()
      bus.onBroadcast(handler)
      bus.send({ from: 'a', to: '*', type: 'broadcast', content: 'broadcast' })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('getHistory', () => {
    it('returns all messages when no agent filter', () => {
      bus.send({ from: 'a', to: 'b', type: 'task', content: 'x' })
      bus.send({ from: 'b', to: 'a', type: 'result', content: 'y' })
      expect(bus.getHistory()).toHaveLength(2)
    })

    it('filters by agent', () => {
      bus.send({ from: 'a', to: 'b', type: 'task', content: 'x' })
      bus.send({ from: 'c', to: 'd', type: 'task', content: 'y' })
      const history = bus.getHistory('a')
      expect(history).toHaveLength(1)
      expect(history[0].from).toBe('a')
    })

    it('respects limit', () => {
      for (let i = 0; i < 10; i++) {
        bus.send({ from: 'a', to: 'b', type: 'task', content: `msg-${i}` })
      }
      expect(bus.getHistory(undefined, 3)).toHaveLength(3)
    })
  })

  describe('getConversation', () => {
    it('returns messages between two agents', () => {
      bus.send({ from: 'a', to: 'b', type: 'task', content: 'hello' })
      bus.send({ from: 'b', to: 'a', type: 'result', content: 'hi' })
      bus.send({ from: 'c', to: 'd', type: 'task', content: 'other' })
      const conv = bus.getConversation('a', 'b')
      expect(conv).toHaveLength(2)
    })
  })

  describe('maxHistory', () => {
    it('evicts old messages when limit reached', () => {
      const limitedBus = new MessageBus(3)
      for (let i = 0; i < 5; i++) {
        limitedBus.send({ from: 'a', to: 'b', type: 'task', content: `msg-${i}` })
      }
      expect(limitedBus.getMessageCount()).toBe(3)
    })
  })

  describe('clear', () => {
    it('removes all messages', () => {
      bus.send({ from: 'a', to: 'b', type: 'task', content: 'x' })
      bus.clear()
      expect(bus.getMessageCount()).toBe(0)
    })
  })
})
