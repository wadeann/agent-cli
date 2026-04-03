import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryManager } from '../../src/memory/MemoryManager.js'
import { CompactionEngine } from '../../src/compaction/CompactionEngine.js'
import { CostTracker } from '../../src/harness/CostTracker.js'
import { REPLSession } from '../../src/repl/REPLSession.js'
import { registerDefaultCommands } from '../../src/repl/Commands.js'
import { TaskGraphManager } from '../../src/tasks/TaskGraph.js'
import { TaskScheduler } from '../../src/tasks/TaskScheduler.js'
import { CheckpointManager } from '../../src/tasks/CheckpointManager.js'
import { PluginManager } from '../../src/plugins/PluginManager.js'
import { PluginLoader } from '../../src/plugins/PluginLoader.js'
import { PluginContextFactory } from '../../src/plugins/ExtensionPoints.js'
import { UIManager } from '../../src/ui/UIManager.js'
import { TerminalRenderer } from '../../src/ui/TerminalRenderer.js'
import { TokenEstimator } from '../../src/compaction/TokenEstimator.js'
import type { ChatMessage } from '../../src/providers/base/types.js'
import type { TaskV2 } from '../../src/tasks/types.js'
import type { PluginV2 } from '../../src/plugins/types.js'

function createMockProvider() {
  return {
    providerName: 'test',
    initialize: async () => {},
    destroy: () => {},
    listModels: () => [{
      id: 'test-model',
      name: 'Test Model',
      provider: 'test',
      contextWindow: 100000,
      maxOutputTokens: 4096,
      capabilities: { vision: false, tools: false, thinking: false, streaming: false },
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

describe('Integration: Full Conversation Workflow', () => {
  it('handles multi-turn conversation with memory, compaction, and cost tracking', async () => {
    const memoryManager = new MemoryManager()
    const compactionEngine = new CompactionEngine()
    const costTracker = new CostTracker({ dailyLimit: 10, perRequestLimit: 1 })
    const provider = createMockProvider()

    const session = new REPLSession(provider as any, { memoryManager, compactionEngine, costTracker })
    registerDefaultCommands(session)

    // Turn 1: User asks a question
    const r1 = await session.handleInput('What is TypeScript?')
    expect(r1).toContain('Response to')
    expect(session.getMessageCount()).toBe(2)

    // Turn 2: Follow-up
    const r2 = await session.handleInput('How does it compare to JavaScript?')
    expect(r2).toContain('Response to')
    expect(session.getMessageCount()).toBe(4)

    // Turn 3: Save memory
    memoryManager.addEntry('user', 'Interest', 'User is interested in TypeScript')
    memoryManager.addEntry('feedback', 'Style', 'Prefers concise explanations')

    // Turn 4: Check memory
    const memResult = await session.handleInput('/memory')
    expect(memResult).toContain('Memory stats')
    expect(memResult).toContain('User: 1')
    expect(memResult).toContain('Feedback: 1')

    // Turn 5: Search memory
    const searchResult = await session.handleInput('/memory TypeScript')
    expect(searchResult).toContain('TypeScript')

    // Turn 6: Check cost
    const costResult = await session.handleInput('/cost')
    expect(costResult).toContain('Session cost')

    // Turn 7: Compact conversation
    const compactResult = await session.handleInput('/compact')
    expect(compactResult).toContain('Compacted')
    expect(compactResult).toContain('tokens')

    // Turn 8: Continue after compact
    const r8 = await session.handleInput('Tell me about Rust')
    expect(r8).toContain('Response to')
  })
})

describe('Integration: Task DAG with Checkpoints', () => {
  it('manages task lifecycle with dependencies and checkpoints', () => {
    const graph = new TaskGraphManager()
    const scheduler = new TaskScheduler(graph)
    const checkpointManager = new CheckpointManager(graph)

    // Create task DAG
    const task1: TaskV2 = {
      id: 'setup',
      title: 'Setup project',
      description: 'Initialize project structure',
      status: 'pending',
      priority: 'high',
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxRetries: 3,
      retryCount: 0
    }

    const task2: TaskV2 = {
      id: 'implement',
      title: 'Implement feature',
      description: 'Build the core feature',
      status: 'pending',
      priority: 'medium',
      dependencies: ['setup'],
      subtasks: [],
      checkpoints: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxRetries: 3,
      retryCount: 0
    }

    const task3: TaskV2 = {
      id: 'test',
      title: 'Write tests',
      description: 'Add unit and integration tests',
      status: 'pending',
      priority: 'medium',
      dependencies: ['implement'],
      subtasks: [],
      checkpoints: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxRetries: 3,
      retryCount: 0
    }

    graph.addTask(task1)
    graph.addTask(task2)
    graph.addTask(task3)

    // Schedule: task1 should be first (no deps)
    const schedule = scheduler.schedule()
    expect(schedule.hasCycle).toBe(false)
    expect(schedule.orderedTasks).toHaveLength(3)

    // Execute task 1
    graph.updateTaskStatus('setup', 'running')
    const cp1 = checkpointManager.createCheckpoint('setup', 'Dependencies installed', { packages: ['express', 'typescript'] })
    expect(cp1).not.toBeNull()
    graph.setTaskResult('setup', { output: 'done', success: true })

    // Now task2 should be ready
    const nextTask = scheduler.getNextTask()
    expect(nextTask?.id).toBe('implement')

    // Execute task 2
    graph.updateTaskStatus('implement', 'running')
    checkpointManager.createCheckpoint('implement', 'Core logic complete', { files: ['src/index.ts', 'src/utils.ts'] })
    graph.setTaskResult('implement', { output: 'feature built', success: true })

    // Now task3 should be ready
    const finalTask = scheduler.getNextTask()
    expect(finalTask?.id).toBe('test')

    // Execute task 3
    graph.setTaskResult('test', { output: 'all tests pass', success: true })

    // Verify all completed
    expect(graph.getTask('setup')?.status).toBe('completed')
    expect(graph.getTask('implement')?.status).toBe('completed')
    expect(graph.getTask('test')?.status).toBe('completed')

    // Verify checkpoints
    expect(checkpointManager.getCheckpointCount('setup')).toBe(1)
    expect(checkpointManager.getCheckpointCount('implement')).toBe(1)

    // Restore checkpoint
    const restored = checkpointManager.restoreCheckpoint('setup', cp1!.id)
    expect(restored).toEqual({ packages: ['express', 'typescript'] })
  })
})

describe('Integration: Plugin System with Tools', () => {
  it('registers plugin, activates it, and exposes tools', async () => {
    const pluginManager = new PluginManager()
    const pluginLoader = new PluginLoader()

    // Create a plugin with tools and commands
    const testPlugin: PluginV2 = {
      manifest: {
        id: 'code-helper',
        name: 'Code Helper',
        version: '1.0.0',
        description: 'Helps with code tasks'
      },
      status: 'installed',
      tools: [
        { name: 'explain', description: 'Explain code', inputSchema: { type: 'object' } } as any,
        { name: 'refactor', description: 'Refactor code', inputSchema: { type: 'object' } } as any
      ],
      commands: [
        { name: 'lint', description: 'Run linter', handler: async () => {} }
      ],
      onActivate: async (ctx) => {
        ctx.logger.info('Code Helper activated')
      }
    }

    // Validate and register
    const validation = pluginLoader.validatePlugin(testPlugin as unknown as Record<string, unknown>)
    expect(validation.valid).toBe(true)

    pluginManager.register(testPlugin)
    expect(pluginManager.getPlugin('code-helper')?.status).toBe('installed')

    // Activate
    const ctx = PluginContextFactory.createContext({ verbose: true })
    const activated = await pluginManager.activate('code-helper', ctx)
    expect(activated).toBe(true)
    expect(pluginManager.getPlugin('code-helper')?.status).toBe('activated')

    // Verify tools are exposed
    const tools = pluginManager.getAllTools()
    expect(tools.size).toBe(2)
    expect(tools.has('explain')).toBe(true)
    expect(tools.has('refactor')).toBe(true)

    // Verify commands are exposed
    const commands = pluginManager.getAllCommands()
    expect(commands.size).toBe(1)
    expect(commands.has('lint')).toBe(true)

    // Stats
    expect(pluginManager.getActivePluginCount()).toBe(1)
  })
})

describe('Integration: UI with Token Estimation and Compaction', () => {
  it('tracks UI state through conversation lifecycle', () => {
    const ui = new UIManager()
    const renderer = new TerminalRenderer(80, 24)
    const estimator = new TokenEstimator()
    const compactionEngine = new CompactionEngine()

    // User sends message
    ui.addMessage('user', 'Build me a REST API with Express')
    ui.setStreaming(true)

    const userMsg = renderer.renderMessage(ui.getMessages()[0])
    expect(userMsg).toContain('Build me a REST API')

    // Assistant starts responding
    ui.updateLastMessage('Building me a REST API with Express...')
    ui.setStreaming(false)

    // Tool execution
    const toolExec = ui.addToolExecution('Write', 'path: src/index.ts')
    ui.updateToolExecution(toolExec.id, { status: 'success', output: 'File created' })

    // Progress tracking
    ui.setProgress({ currentStep: 1, totalSteps: 5, message: 'Creating routes', percentage: 20 })
    ui.updateProgress('Creating controllers', 2)
    expect(ui.getProgress()?.percentage).toBe(40)

    // Token estimation
    const messages: ChatMessage[] = ui.getMessages().map(m => ({
      role: m.type as ChatMessage['role'],
      content: m.content
    }))
    const estimate = estimator.estimateMessages(messages)
    expect(estimate.total).toBeGreaterThan(0)

    // Cost summary
    ui.setCostSummary({ totalCost: 0.0234, totalTokens: estimate.total, requests: 3 })
    const costLine = renderer.renderCostSummary(ui.getState().costSummary!)
    expect(costLine).toContain('$0.0234')

    // Auto-compact check
    const shouldCompact = compactionEngine.shouldAutoCompact(messages, 100000)
    expect(typeof shouldCompact).toBe('boolean')

    // Reset
    ui.reset()
    expect(ui.getMessages()).toHaveLength(0)
    expect(ui.getToolExecutions()).toHaveLength(0)
    expect(ui.getProgress()).toBeNull()
    expect(ui.isStreaming()).toBe(false)
  })
})

describe('Integration: Memory + Compaction Combined', () => {
  it('uses memory context during compaction', async () => {
    const memoryManager = new MemoryManager()
    memoryManager.addEntry('user', 'Goal', 'Build a CLI tool')
    memoryManager.addEntry('feedback', 'Style', 'Use TypeScript, keep it simple')
    memoryManager.addEntry('project', 'Status', 'Phase 1 complete, moving to Phase 2')
    memoryManager.addEntry('reference', 'Stack', 'Bun + TypeScript + Commander')

    const compactionEngine = new CompactionEngine()

    // Simulate a long conversation
    const messages: ChatMessage[] = []
    for (let i = 0; i < 30; i++) {
      messages.push({ role: 'user', content: `Question ${i}: ${'a'.repeat(200)}` })
      messages.push({ role: 'assistant', content: `Answer ${i}: ${'b'.repeat(200)}` })
    }

    // Get relevant memory context
    const memoryContext = memoryManager.getRelevantContext('CLI TypeScript project')
    expect(memoryContext).toContain('User Context')
    expect(memoryContext).toContain('CLI tool')
    expect(memoryContext).toContain('TypeScript')

    // Compact using session memory
    const result = compactionEngine.compactWithSessionMemory(messages, memoryContext, 200000)
    expect(result.method).toBe('session-memory')
    expect(result.tokensSaved).toBeGreaterThan(0)
    expect(result.summary).toContain('User Context')
  })
})

describe('Integration: Full Agent Loop', () => {
  it('simulates complete agent conversation with all subsystems', async () => {
    // Initialize all subsystems
    const memoryManager = new MemoryManager()
    const compactionEngine = new CompactionEngine()
    const costTracker = new CostTracker({ dailyLimit: 10, perRequestLimit: 1 })
    const ui = new UIManager()
    const estimator = new TokenEstimator()
    const provider = createMockProvider()

    const session = new REPLSession(provider as any, { memoryManager, compactionEngine, costTracker })
    registerDefaultCommands(session)

    // Pre-load memory
    memoryManager.addEntry('user', 'Role', 'Senior developer')
    memoryManager.addEntry('project', 'Codebase', 'TypeScript CLI tool')

    // Simulate agent loop
    const inputs = [
      'Help me add a new command to the CLI',
      'What files should I modify?',
      'Write the implementation',
      'Add tests for it',
      '/memory Codebase',
      '/cost'
    ]

    for (const input of inputs) {
      const result = await session.handleInput(input)
      ui.addMessage('user', input)
      ui.addMessage('assistant', result)

      // Track cost
      costTracker.recordUsage(provider as any, 'test-model', { inputTokens: 100, outputTokens: 50 })

      // Check if compaction needed
      const messages = session.getMessages()
      if (compactionEngine.shouldAutoCompact(messages, 100000)) {
        const ctx = memoryManager.getRelevantContext('CLI implementation')
        compactionEngine.compactWithSessionMemory(messages, ctx, 100000)
      }
    }

    // Verify final state
    expect(session.getMessageCount()).toBeGreaterThanOrEqual(inputs.length)
    expect(ui.getMessages().length).toBe(inputs.length * 2)
    expect(memoryManager.getStats().total).toBe(2)

    // Render final summary
    const state = session.getState()
    const summary = renderer.renderCostSummary({
      totalCost: costTracker.getSummary().today,
      totalTokens: state.tokenCount,
      requests: costTracker.getSummary().totalRequests
    })
    expect(summary).toContain('$')
  })
})

const renderer = new TerminalRenderer(80, 24)
