import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ProjectContextManager } from '../../src/context/ProjectContext.js'
import { SmartContextManager } from '../../src/context/SmartContext.js'
import { InteractiveRefiner } from '../../src/context/InteractiveRefiner.js'
import { SelfCorrectingRecovery } from '../../src/context/SelfCorrectingRecovery.js'
import { MemoryManager } from '../../src/memory/MemoryManager.js'
import { CompactionEngine } from '../../src/compaction/CompactionEngine.js'
import { CircuitBreaker } from '../../src/harness/blocking/CircuitBreaker.js'
import { MessageBus } from '../../src/agents/MessageBus.js'
import { AgentCoordinator } from '../../src/agents/AgentCoordinator.js'
import { SecurityValidator } from '../../src/security/SecurityValidator.js'
import { ErrorReporter } from '../../src/errors/AgentErrors.js'
import { SyncManager } from '../../src/sync/SyncManager.js'
import { LRUCache, PerformanceMetrics } from '../../src/optimization/PerformanceOptimizer.js'
import type { ChatMessage } from '../../src/providers/base/types.js'
import type { SyncProvider } from '../../src/sync/types.js'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { join, tmpdir } from 'path'
import { tmpdir as osTmpdir } from 'os'

function createMockProvider() {
  return {
    providerName: 'test',
    initialize: async () => {},
    destroy: () => {},
    listModels: () => [{
      id: 'test-model', name: 'Test', provider: 'test', contextWindow: 100000,
      maxOutputTokens: 4096, capabilities: { vision: false, tools: false, thinking: false, streaming: false },
      pricing: { inputPer1M: 1, outputPer1M: 3 }
    }],
    getModel: () => null,
    isModelAvailable: () => true,
    chat: async (messages: ChatMessage[]) => ({
      content: `Response to: ${typeof messages[messages.length - 1].content === 'string' ? messages[messages.length - 1].content : '[complex]'}`,
      usage: { inputTokens: 50 + messages.length * 10, outputTokens: 20 },
      finishReason: 'end_turn' as const,
      model: 'test-model'
    }),
    chatStream: async function* () {},
    calculateCost: () => 0.001
  }
}

function createMockSyncProvider(): SyncProvider {
  const store = new Map<string, { content: string; version: number }>()
  return {
    push: async (key, content, version) => { store.set(key, { content, version }) },
    pull: async (key) => { const e = store.get(key); return e ? { content: e.content, version: e.version } : null },
    list: async () => Array.from(store.keys()),
    delete: async (key) => { store.delete(key) }
  }
}

describe('E2E: Complete System Integration', () => {
  let projectDir: string

  beforeEach(() => {
    const suffix = Math.random().toString(36).slice(2, 10)
    projectDir = mkdtempSync(join(osTmpdir(), `e2e-${suffix}-`))
  })

  afterEach(() => {
    if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true })
  })

  it('full agent workflow: context + memory + agents + security + error recovery', async () => {
    // 1. Initialize all subsystems
    const projectCtx = new ProjectContextManager(projectDir)
    const smartCtx = new SmartContextManager()
    const refiner = new InteractiveRefiner('Implement feature', { maxAttempts: 3, strategies: ['direct', 'incremental', 'refactor'] })
    const recovery = new SelfCorrectingRecovery()
    const memory = new MemoryManager()
    const compaction = new CompactionEngine()
    const breaker = new CircuitBreaker({ maxSteps: 50, maxRetriesPerTask: 3, loopDetectionWindow: 8, loopThreshold: 2 })
    const bus = new MessageBus()
    const coordinator = new AgentCoordinator(bus)
    const security = new SecurityValidator()
    const errorReporter = new ErrorReporter()
    const sync = new SyncManager()
    sync.setProvider(createMockSyncProvider())
    const cache = new LRUCache<string, string>(100)
    const metrics = new PerformanceMetrics()

    // 2. Project context scan
    projectCtx.scanProject()
    expect(projectCtx.getContext().fileIndex.size).toBeGreaterThanOrEqual(0)

    // 3. Register agents
    coordinator.registerAgent({
      id: 'planner', name: 'Planner', role: 'planner',
      capabilities: ['plan'], systemPrompt: 'Plan tasks'
    }, async () => 'Task plan created')

    coordinator.registerAgent({
      id: 'coder', name: 'Coder', role: 'coder',
      capabilities: ['code'], systemPrompt: 'Write code'
    }, async () => 'Code written')

    coordinator.registerAgent({
      id: 'reviewer', name: 'Reviewer', role: 'reviewer',
      capabilities: ['review'], systemPrompt: 'Review code'
    }, async () => 'Review passed')

    // 4. Multi-agent collaboration
    const collabResult = await coordinator.collaborate(
      ['planner', 'coder', 'reviewer'],
      'Build a new feature'
    )
    expect(collabResult.success).toBe(true)
    expect(collabResult.steps).toBe(3)

    // 5. Security validation
    const securityCheck = security.validateInput('Build a new feature')
    expect(securityCheck.valid).toBe(true)

    const dangerousCheck = security.validateInput('rm -rf /')
    expect(dangerousCheck.valid).toBe(false)

    // 6. Memory operations
    memory.addEntry('user', 'Goal', 'Build a CLI tool')
    memory.addEntry('project', 'Status', 'In progress')
    const searchResults = memory.search('CLI tool')
    expect(searchResults.length).toBeGreaterThan(0)

    // 7. Smart context building
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Build a CLI tool' },
      { role: 'assistant', content: 'I will help you build a CLI tool.' },
      { role: 'tool', content: 'File created successfully' },
      { role: 'assistant', content: 'The file has been created.' }
    ]
    const context = smartCtx.buildContext({
      systemPrompt: 'You are a helpful coding assistant',
      messages,
      memoryContext: memory.getRelevantContext('CLI tool')
    })
    expect(context.totalTokens).toBeGreaterThan(0)
    expect(context.recentMessages.length).toBeGreaterThan(0)

    // 8. Compaction check
    const shouldCompact = compaction.shouldAutoCompact(messages, 100000)
    expect(typeof shouldCompact).toBe('boolean')

    // 9. Circuit breaker
    const breakerCheck = breaker.recordStep('collaboration', 'agent')
    expect(breakerCheck.shouldStop).toBe(false)

    // 10. Interactive refinement loop
    refiner.recordAttempt('Try direct approach', false, 'Type error')
    expect(refiner.shouldRetry()).toBe(true)
    const nextStrategy = refiner.getNextStrategy()
    expect(nextStrategy).toBe('incremental')

    refiner.recordAttempt('Try incremental approach', true, 'All tests pass')
    expect(refiner.isComplete()).toBe(true)

    // 11. Error recovery
    const { ProviderAuthError } = await import('../../src/errors/AgentErrors.js')
    const authError = new ProviderAuthError('anthropic')
    errorReporter.report(authError)
    const analysis = recovery.analyzeError(authError)
    expect(analysis.rootCause).toBeDefined()
    expect(analysis.suggestions.length).toBeGreaterThan(0)

    // 12. Sync operations
    sync.registerLocal('config', '{"key": "value"}')
    const syncResult = await sync.sync('push')
    expect(syncResult.pushed).toBeGreaterThanOrEqual(0)

    // 13. Performance tracking
    const stopTimer = metrics.startTimer('full-workflow')
    // ... work done ...
    const elapsed = stopTimer()
    expect(elapsed).toBeGreaterThanOrEqual(0)

    // 14. Cache operations
    cache.set('result', 'cached value')
    expect(cache.get('result')).toBe('cached value')

    // 15. Final state verification
    expect(coordinator.getAgentCount()).toBe(3)
    expect(memory.getStats().total).toBe(2)
    expect(breaker.getState().suspended).toBe(false)
    expect(errorReporter.getErrorCount()).toBe(1)
    expect(projectCtx.getContext().fileIndex.size).toBeGreaterThanOrEqual(0)
  })

  it('self-correcting workflow: detect error, analyze, suggest fix, retry', async () => {
    const refiner = new InteractiveRefiner('Fix compilation error', {
      maxAttempts: 3,
      strategies: ['fix-type', 'fix-import', 'fix-logic']
    })
    const recovery = new SelfCorrectingRecovery()
    const metrics = new PerformanceMetrics()

    // Attempt 1: Fail
    const stop1 = metrics.startTimer('attempt-1')
    refiner.recordAttempt('Fix type annotations', false, 'Type mismatch on line 42')
    stop1()

    // Analyze error
    const { ToolError } = await import('../../src/errors/AgentErrors.js')
    const toolError = new ToolError('Type mismatch on line 42', { context: { tool: 'TypeScript' } })
    const analysis = recovery.analyzeError(toolError)
    expect(analysis.suggestions.length).toBeGreaterThan(0)

    // Switch strategy
    expect(refiner.shouldRetry()).toBe(true)
    const strategy = refiner.getNextStrategy()
    expect(strategy).toBe('fix-import')

    // Attempt 2: Fail
    refiner.recordAttempt('Fix imports', false, 'Module not found')
    expect(refiner.shouldRetry()).toBe(true)

    // Analyze second error
    const error2 = new ToolError('Module not found', { context: { tool: 'import' } })
    const analysis2 = recovery.analyzeError(error2)
    expect(analysis2.suggestions.length).toBeGreaterThan(0)

    // Switch strategy again
    const strategy2 = refiner.getNextStrategy()
    expect(strategy2).toBe('fix-logic')

    // Attempt 3: Success
    refiner.recordAttempt('Fix logic', true, 'All tests pass')
    expect(refiner.isComplete()).toBe(true)

    // Verify metrics were tracked
    const timing = metrics.getTiming('attempt-1')
    expect(timing).not.toBeNull()
    expect(timing!.count).toBe(1)
  })

  it('memory + compaction + sync integration', async () => {
    const memory = new MemoryManager()
    const compaction = new CompactionEngine()
    const sync = new SyncManager()
    sync.setProvider(createMockSyncProvider())

    // Build up memory
    for (let i = 0; i < 20; i++) {
      memory.addEntry('project', `Task ${i}`, `Task ${i} description with details about implementation`)
    }

    // Build conversation
    const messages: ChatMessage[] = []
    for (let i = 0; i < 30; i++) {
      messages.push({ role: 'user', content: `Question ${i}: ${'a'.repeat(100)}` })
      messages.push({ role: 'assistant', content: `Answer ${i}: ${'b'.repeat(100)}` })
    }

    // Get relevant context
    const relevantContext = memory.getRelevantContext('implementation task')
    expect(relevantContext.length).toBeGreaterThan(0)

    // Compact with session memory
    const compactResult = compaction.compactWithSessionMemory(messages, relevantContext, 200000)
    expect(compactResult.tokensSaved).toBeGreaterThan(0)
    expect(compactResult.method).toBe('session-memory')

    // Sync memory to remote
    sync.registerLocal('memory-project', JSON.stringify(memory.getEntriesByLayer('project')))
    const syncResult = await sync.sync('push')
    expect(syncResult.pushed).toBeGreaterThanOrEqual(1)
  })
})
