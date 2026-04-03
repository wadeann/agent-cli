import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryManager } from '../../src/memory/MemoryManager.js'
import { CompactionEngine } from '../../src/compaction/CompactionEngine.js'
import { CostTracker } from '../../src/harness/CostTracker.js'
import { CircuitBreaker } from '../../src/harness/blocking/CircuitBreaker.js'
import { SubprocessManager } from '../../src/harness/blocking/SubprocessManager.js'
import { RouterWorkerManager } from '../../src/harness/blocking/RouterWorker.js'
import { ParallelFunctionCaller } from '../../src/harness/blocking/ParallelFunctionCaller.js'
import { PluginManager } from '../../src/plugins/PluginManager.js'
import { PluginContextFactory } from '../../src/plugins/ExtensionPoints.js'
import { TaskGraphManager } from '../../src/tasks/TaskGraph.js'
import { TaskScheduler } from '../../src/tasks/TaskScheduler.js'
import { CheckpointManager } from '../../src/tasks/CheckpointManager.js'
import { UIManager } from '../../src/ui/UIManager.js'
import type { ChatMessage } from '../../src/providers/base/types.js'
import type { TaskV2 } from '../../src/tasks/types.js'
import type { PluginV2 } from '../../src/plugins/types.js'
import type { RouterTask } from '../../src/harness/blocking/types.js'

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

describe('E2E: Full Agent Loop with All Subsystems', () => {
  it('completes 50-turn conversation without blocking', async () => {
    const memory = new MemoryManager()
    const compaction = new CompactionEngine()
    const cost = new CostTracker({ dailyLimit: 100, perRequestLimit: 10 })
    const breaker = new CircuitBreaker({ maxSteps: 200, maxRetriesPerTask: 5, loopDetectionWindow: 10, loopThreshold: 3 })
    const ui = new UIManager()
    const provider = createMockProvider()

    // Pre-load memory
    memory.addEntry('user', 'Role', 'Senior developer')
    memory.addEntry('project', 'Stack', 'TypeScript CLI tool')
    memory.addEntry('feedback', 'Style', 'Concise responses')

    // Simulate 50-turn conversation
    for (let i = 0; i < 50; i++) {
      const input = `Question ${i}: ${'a'.repeat(50)}`
      ui.addMessage('user', input)

      const check = breaker.recordStep(`turn-${i}`, 'chat')
      if (check.shouldStop) break

      const response = await (provider as any).chat([{ role: 'user', content: input }])
      ui.addMessage('assistant', response.content)

      cost.recordUsage(provider as any, 'test-model', response.usage)

      // Periodic memory updates
      if (i % 10 === 0) {
        memory.addEntry('project', `Progress ${i}`, `Completed turn ${i}`)
      }

      // Check if compaction needed
      if (compaction.shouldAutoCompact(ui.getMessages().map(m => ({ role: m.type as ChatMessage['role'], content: m.content })), 100000)) {
        const ctx = memory.getRelevantContext('progress')
        compaction.compactWithSessionMemory(ui.getMessages().map(m => ({ role: m.type as ChatMessage['role'], content: m.content })), ctx, 100000)
      }
    }

    expect(breaker.getState().suspended).toBe(false)
    expect(ui.getMessages().length).toBe(100)
    expect(memory.getStats().total).toBeGreaterThanOrEqual(3)
    expect(cost.getSummary().totalRequests).toBe(50)
  })

  it('handles concurrent task execution with checkpointing', async () => {
    const graph = new TaskGraphManager()
    const scheduler = new TaskScheduler(graph)
    const checkpoints = new CheckpointManager(graph)
    const manager = new RouterWorkerManager()
    const caller = new ParallelFunctionCaller({ maxConcurrency: 5, timeoutMs: 5000 })

    // Create task DAG
    const tasks: TaskV2[] = [
      { id: 'setup', title: 'Setup', description: '', status: 'pending', priority: 'high', dependencies: [], subtasks: [], checkpoints: [], createdAt: Date.now(), updatedAt: Date.now(), maxRetries: 3, retryCount: 0 },
      { id: 'build', title: 'Build', description: '', status: 'pending', priority: 'medium', dependencies: ['setup'], subtasks: [], checkpoints: [], createdAt: Date.now(), updatedAt: Date.now(), maxRetries: 3, retryCount: 0 },
      { id: 'test', title: 'Test', description: '', status: 'pending', priority: 'medium', dependencies: ['build'], subtasks: [], checkpoints: [], createdAt: Date.now(), updatedAt: Date.now(), maxRetries: 3, retryCount: 0 }
    ]
    for (const t of tasks) graph.addTask(t)

    // Register workers
    manager.registerWorker('setup', async (task: RouterTask) => {
      graph.updateTaskStatus(task.id, 'completed')
      checkpoints.createCheckpoint(task.id, 'Setup complete', { done: true })
      return { taskId: task.id, success: true, output: 'done', completedAt: Date.now() }
    })
    manager.registerWorker('build', async (task: RouterTask) => {
      graph.updateTaskStatus(task.id, 'completed')
      return { taskId: task.id, success: true, output: 'built', completedAt: Date.now() }
    })
    manager.registerWorker('test', async (task: RouterTask) => {
      graph.updateTaskStatus(task.id, 'completed')
      return { taskId: task.id, success: true, output: 'passed', completedAt: Date.now() }
    })

    // Execute tasks in order
    const schedule = scheduler.schedule()
    expect(schedule.hasCycle).toBe(false)

    for (const task of schedule.orderedTasks) {
      manager.dispatchTask({ id: task.id, type: task.id, payload: {}, priority: 'normal', createdAt: Date.now() })
      await new Promise(r => setTimeout(r, 20))
    }

    await new Promise(r => setTimeout(r, 100))

    expect(graph.getTask('setup')?.status).toBe('completed')
    expect(graph.getTask('build')?.status).toBe('completed')
    expect(graph.getTask('test')?.status).toBe('completed')
    expect(checkpoints.getCheckpointCount('setup')).toBeGreaterThanOrEqual(1)
  })

  it('plugin system integrates with task system', async () => {
    const pluginManager = new PluginManager()
    const graph = new TaskGraphManager()
    const scheduler = new TaskScheduler(graph)

    const taskPlugin: PluginV2 = {
      manifest: { id: 'task-helper', name: 'Task Helper', version: '1.0.0', description: 'Helps with tasks' },
      status: 'installed',
      commands: [{ name: 'create-task', description: 'Create task', handler: async () => {} }],
      onActivate: async (ctx) => {
        ctx.storage.set('activated', true)
      }
    }

    pluginManager.register(taskPlugin)
    const ctx = PluginContextFactory.createContext()
    await pluginManager.activate('task-helper', ctx)

    expect(pluginManager.getActivePluginCount()).toBe(1)
    expect(ctx.storage.get('activated')).toBe(true)
    expect(pluginManager.getAllCommands().size).toBe(1)
  })

  it('subprocess monitoring with circuit breaker integration', async () => {
    const procManager = new SubprocessManager(5)
    const breaker = new CircuitBreaker({ maxSteps: 10, maxRetriesPerTask: 3, timeoutMs: 500 })

    const handle = await procManager.spawn('echo', ['hello'])
    breaker.recordStep('spawn echo', 'Subprocess')
    await handle.waitForExit()

    expect(handle.status).toBe('completed')
    expect(breaker.getState().suspended).toBe(false)

    // Test timeout scenario
    const slowHandle = await procManager.spawn('sleep', ['10'], { timeoutMs: 100 })
    breaker.recordStep('spawn sleep', 'Subprocess')
    await slowHandle.waitForExit()

    expect(slowHandle.status).toBe('timeout')
    expect(breaker.getStepHistory()).toHaveLength(2)
  })

  it('pub/sub coordinates with memory and compaction', async () => {
    const manager = new RouterWorkerManager()
    const memory = new MemoryManager()
    const compaction = new CompactionEngine()

    // Subscribe to task events and update memory
    manager.getPubSub().subscribe('task.completed', (msg) => {
      memory.addEntry('project', `Task ${msg.data.taskId}`, 'Completed')
    })

    manager.getPubSub().subscribe('task.failed', (msg) => {
      memory.addEntry('feedback', `Task ${msg.data.taskId}`, `Failed: ${msg.data.error}`)
    })

    manager.registerWorker('process', async (task: RouterTask) => {
      return { taskId: task.id, success: true, output: 'done', completedAt: Date.now() }
    })

    // Dispatch multiple tasks
    for (let i = 0; i < 5; i++) {
      manager.dispatchTask({ id: `task-${i}`, type: 'process', payload: {}, priority: 'normal', createdAt: Date.now() })
    }

    await new Promise(r => setTimeout(r, 100))

    expect(memory.getStats().project).toBe(5)
    expect(memory.getStats().total).toBe(5)

    // Verify memory search works
    const results = memory.search('Completed')
    expect(results.length).toBeGreaterThan(0)
  })
})
