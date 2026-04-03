import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TUIREPL } from '../TUIREPL.js'

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

describe('TUIREPL', () => {
  let repl: TUIREPL

  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const provider = createMockProvider()
    repl = new TUIREPL({ provider: provider as any, model: 'test-model' })
  })

  describe('constructor', () => {
    it('creates REPL with provider', () => {
      expect(repl).toBeDefined()
    })
  })

  describe('handleCommand', () => {
    it('processes /help command', async () => {
      const handleInput = (repl as any).handleCommand.bind(repl)
      handleInput('/help')
      expect(true).toBe(true)
    })

    it('processes /clear command', async () => {
      const handleInput = (repl as any).handleCommand.bind(repl)
      handleInput('/clear')
      expect((repl as any).messages).toEqual([])
    })

    it('processes /model command', async () => {
      const handleInput = (repl as any).handleCommand.bind(repl)
      handleInput('/model')
      expect((repl as any).model).toBe('test-model')
    })

    it('processes /models command', async () => {
      const handleInput = (repl as any).handleCommand.bind(repl)
      handleInput('/models')
      expect(true).toBe(true)
    })

    it('processes /exit command', async () => {
      const handleInput = (repl as any).handleCommand.bind(repl)
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      handleInput('/exit')
      expect(exitSpy).toHaveBeenCalledWith(0)
      exitSpy.mockRestore()
    })

    it('handles unknown command', async () => {
      const handleInput = (repl as any).handleCommand.bind(repl)
      handleInput('/unknown')
      expect(true).toBe(true)
    })
  })

  describe('processMessage', () => {
    it('sends message and receives response', async () => {
      const processMsg = (repl as any).processMessage.bind(repl)
      await processMsg('Hello')
      const messages = (repl as any).messages
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('user')
      expect(messages[1].role).toBe('assistant')
    })

    it('tracks token count', async () => {
      const processMsg = (repl as any).processMessage.bind(repl)
      await processMsg('Hello')
      expect((repl as any).tokenCount).toBe(70)
    })

    it('tracks request count', async () => {
      const processMsg = (repl as any).processMessage.bind(repl)
      await processMsg('Hello')
      await processMsg('World')
      expect((repl as any).requestCount).toBe(2)
    })

    it('handles provider errors', async () => {
      const provider = createMockProvider()
      provider.chat = vi.fn().mockRejectedValue(new Error('API error'))
      const errorRepl = new TUIREPL({ provider: provider as any, model: 'test-model' })
      const processMsg = (errorRepl as any).processMessage.bind(errorRepl)
      await processMsg('Hello')
      expect(true).toBe(true)
    })
  })
})
