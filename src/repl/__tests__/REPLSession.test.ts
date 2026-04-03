import { describe, it, expect, beforeEach, vi } from 'vitest'
import { REPLSession } from '../REPLSession.js'
import { registerDefaultCommands } from '../Commands.js'

function createMockProvider() {
  return {
    providerName: 'test',
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    listModels: () => [{
      id: 'test-model',
      name: 'Test Model',
      provider: 'test',
      contextWindow: 100000,
      maxOutputTokens: 4096,
      capabilities: { vision: false, tools: false, thinking: false, streaming: false },
      pricing: { inputPer1M: 1, outputPer1M: 3 }
    }],
    getModel: vi.fn().mockReturnValue(null),
    isModelAvailable: vi.fn().mockReturnValue(true),
    chat: vi.fn().mockResolvedValue({
      content: 'Test response',
      usage: { inputTokens: 50, outputTokens: 20 },
      finishReason: 'end_turn',
      model: 'test-model'
    }),
    chatStream: vi.fn(),
    calculateCost: vi.fn().mockReturnValue(0.001)
  }
}

describe('REPLSession', () => {
  let session: REPLSession

  beforeEach(() => {
    const provider = createMockProvider()
    session = new REPLSession(provider as any)
    registerDefaultCommands(session)
  })

  describe('constructor', () => {
    it('creates a session with unique ID', () => {
      const state = session.getState()
      expect(state.id).toMatch(/^session-\d+-[a-z0-9]+$/)
    })

    it('starts with empty message history', () => {
      expect(session.getMessages()).toEqual([])
      expect(session.getMessageCount()).toBe(0)
      expect(session.getTokenCount()).toBe(0)
    })
  })

  describe('handleInput - commands', () => {
    it('executes /help command', async () => {
      const result = await session.handleInput('/help')
      expect(result).toContain('/help')
      expect(result).toContain('/clear')
      expect(result).toContain('/memory')
      expect(result).toContain('/compact')
      expect(result).toContain('/cost')
      expect(result).toContain('/models')
      expect(result).toContain('/exit')
    })

    it('executes /clear command', async () => {
      await session.handleInput('Hello')
      expect(session.getMessageCount()).toBeGreaterThan(0)
      const result = await session.handleInput('/clear')
      expect(result).toContain('cleared')
      expect(session.getMessageCount()).toBe(0)
    })

    it('executes /models command', async () => {
      const result = await session.handleInput('/models')
      expect(result).toContain('test-model')
      expect(result).toContain('Test Model')
    })

    it('executes /exit command', async () => {
      const result = await session.handleInput('/exit')
      expect(result).toBe('__EXIT__')
    })

    it('returns error for unknown command', async () => {
      const result = await session.handleInput('/unknown')
      expect(result).toContain('Unknown command')
    })

    it('handles command errors gracefully', async () => {
      session.registerCommand({
        name: 'fail',
        description: 'Fails',
        handler: async () => { throw new Error('Command failed') }
      })
      const result = await session.handleInput('/fail')
      expect(result).toContain('Command error')
      expect(result).toContain('Command failed')
    })
  })

  describe('handleInput - commands with memory', () => {
    it('/memory shows stats when memory manager configured', async () => {
      const { MemoryManager } = await import('../../memory/MemoryManager.js')
      const memoryManager = new MemoryManager()
      memoryManager.addEntry('user', 'Goal', 'Build a web app')
      memoryManager.addEntry('project', 'Task', 'Implement auth')

      const provider = createMockProvider()
      const sessionWithMemory = new REPLSession(provider as any, { memoryManager })
      registerDefaultCommands(sessionWithMemory)

      const result = await sessionWithMemory.handleInput('/memory')
      expect(result).toContain('Memory stats')
      expect(result).toContain('User: 1')
      expect(result).toContain('Project: 1')
    })

    it('/memory <query> searches memory', async () => {
      const { MemoryManager } = await import('../../memory/MemoryManager.js')
      const memoryManager = new MemoryManager()
      memoryManager.addEntry('user', 'TypeScript preference', 'Prefers TypeScript')
      memoryManager.addEntry('project', 'Python project', 'Uses Python')

      const provider = createMockProvider()
      const sessionWithMemory = new REPLSession(provider as any, { memoryManager })
      registerDefaultCommands(sessionWithMemory)

      const result = await sessionWithMemory.handleInput('/memory TypeScript')
      expect(result).toContain('TypeScript')
    })

    it('/memory returns not configured without memory manager', async () => {
      const result = await session.handleInput('/memory')
      expect(result).toContain('not configured')
    })
  })

  describe('handleInput - commands with compaction', () => {
    it('/compact compacts conversation', async () => {
      const { CompactionEngine } = await import('../../compaction/CompactionEngine.js')
      const compactionEngine = new CompactionEngine()

      const provider = createMockProvider()
      const sessionWithCompaction = new REPLSession(provider as any, { compactionEngine })
      registerDefaultCommands(sessionWithCompaction)

      await sessionWithCompaction.handleInput('Hello')
      await sessionWithCompaction.handleInput('Hi there')
      await sessionWithCompaction.handleInput('How are you?')
      await sessionWithCompaction.handleInput('Good thanks')

      const result = await sessionWithCompaction.handleInput('/compact')
      expect(result).toContain('Compacted')
      expect(result).toContain('tokens')
    })

    it('/compact returns error with too few messages', async () => {
      const { CompactionEngine } = await import('../../compaction/CompactionEngine.js')
      const compactionEngine = new CompactionEngine()

      const provider = createMockProvider()
      const sessionWithCompaction = new REPLSession(provider as any, { compactionEngine })
      registerDefaultCommands(sessionWithCompaction)

      const result = await sessionWithCompaction.handleInput('/compact')
      expect(result).toContain('Not enough messages')
    })

    it('/compact returns not configured without engine', async () => {
      const result = await session.handleInput('/compact')
      expect(result).toContain('not configured')
    })
  })

  describe('handleInput - commands with cost tracking', () => {
    it('/cost shows session cost', async () => {
      const { CostTracker } = await import('../../harness/CostTracker.js')
      const costTracker = new CostTracker({ dailyLimit: 10, perRequestLimit: 1 })

      const provider = createMockProvider()
      provider.calculateCost = vi.fn().mockReturnValue(0.005)
      const sessionWithCost = new REPLSession(provider as any, { costTracker })
      registerDefaultCommands(sessionWithCost)

      await sessionWithCost.handleInput('Hello')

      const result = await sessionWithCost.handleInput('/cost')
      expect(result).toContain('Session cost')
    })

    it('/cost returns not configured without tracker', async () => {
      const result = await session.handleInput('/cost')
      expect(result).toContain('not configured')
    })
  })

  describe('handleInput - messages', () => {
    it('processes user messages', async () => {
      const result = await session.handleInput('Hello, how are you?')
      expect(result).toBe('Test response')
    })

    it('adds messages to history', async () => {
      await session.handleInput('Message 1')
      await session.handleInput('Message 2')
      const messages = session.getMessages()
      expect(messages).toHaveLength(4)
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('Message 1')
      expect(messages[1].role).toBe('assistant')
      expect(messages[2].role).toBe('user')
      expect(messages[2].content).toBe('Message 2')
    })

    it('tracks token count', async () => {
      await session.handleInput('Hello')
      expect(session.getTokenCount()).toBe(70)
    })

    it('handles provider errors', async () => {
      const provider = createMockProvider()
      provider.chat = vi.fn().mockRejectedValue(new Error('API error'))
      const errorSession = new REPLSession(provider as any)
      registerDefaultCommands(errorSession)

      const result = await errorSession.handleInput('Hello')
      expect(result).toContain('Error')
      expect(result).toContain('API error')
    })
  })

  describe('clearHistory', () => {
    it('clears all messages and resets counters', async () => {
      await session.handleInput('Hello')
      await session.handleInput('Hi')
      session.clearHistory()
      expect(session.getMessages()).toEqual([])
      expect(session.getMessageCount()).toBe(0)
      expect(session.getTokenCount()).toBe(0)
    })
  })

  describe('getState', () => {
    it('returns session state', async () => {
      await session.handleInput('Hello')
      const state = session.getState()
      expect(state.messageCount).toBe(2)
      expect(state.tokenCount).toBe(70)
      expect(state.messages).toHaveLength(2)
    })
  })
})
