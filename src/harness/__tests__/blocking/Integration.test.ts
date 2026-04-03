import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CircuitBreaker } from '../../blocking/CircuitBreaker.js'
import { SubprocessManager } from '../../blocking/SubprocessManager.js'
import { RouterWorkerManager } from '../../blocking/RouterWorker.js'
import { ParallelFunctionCaller } from '../../blocking/ParallelFunctionCaller.js'
import type { RouterTask } from '../../blocking/types.js'
import { BaseTool } from '../../../tools/base.js'
import type { ExecutionContext, ToolResult } from '../../../providers/base/types.js'
import type { ToolUseBlock } from '../../../tools/orchestrator/types.js'

function createMockTool(name: string, delayMs = 10): BaseTool {
  return new (class extends BaseTool {
    readonly name = name
    readonly description = `Mock ${name}`
    readonly category = 'execution' as const
    readonly readOnly = true
    readonly dangerous = false
    readonly inputSchema = { type: 'object' }
    async execute(_input: unknown, _ctx: ExecutionContext): Promise<ToolResult> {
      await new Promise(r => setTimeout(r, delayMs))
      return this.success(`${name} done`)
    }
  })()
}

const mockCtx: ExecutionContext = { cwd: '/test', env: {}, sessionId: 'test' }

describe('Integration: Anti-Blocking Full Workflow', () => {
  it('parallel execution with circuit breaker prevents loop', async () => {
    const breaker = new CircuitBreaker({ maxSteps: 100, maxRetriesPerTask: 2, loopDetectionWindow: 10, loopThreshold: 3 })
    const caller = new ParallelFunctionCaller({ maxConcurrency: 3, timeoutMs: 5000 })

    const tools = new Map([
      ['read', createMockTool('read', 10)],
      ['write', createMockTool('write', 10)],
      ['bash', createMockTool('bash', 10)]
    ])

    // Simulate diverse agent loop (not repeating)
    for (let i = 0; i < 4; i++) {
      const toolUses: ToolUseBlock[] = [
        { id: `t${i}-1`, name: 'read', input: {} },
        { id: `t${i}-2`, name: 'write', input: {} }
      ]
      const result = await caller.callParallel(toolUses, tools, mockCtx)
      expect(result.results).toHaveLength(2)

      const check = breaker.recordStep(`tool-call-${i}`, 'parallel')
      if (check.shouldStop) break
    }

    // Should not have triggered circuit breaker (diverse actions)
    expect(breaker.getState().suspended).toBe(false)
    expect(breaker.getState().loopDetected).toBe(false)
  })

  it('circuit breaker suspends on loop detection', async () => {
    const breaker = new CircuitBreaker({ maxSteps: 100, maxRetriesPerTask: 3, loopDetectionWindow: 6, loopThreshold: 2 })

    // Pattern A, B repeated 3 times (window=6, threshold=2 means 2 consecutive repeats of 2-action pattern)
    breaker.recordStep('A')
    breaker.recordStep('B')
    breaker.recordStep('A')
    breaker.recordStep('B')
    breaker.recordStep('A')
    breaker.recordStep('B')

    expect(breaker.getState().loopDetected).toBe(true)
    expect(breaker.getState().suspended).toBe(true)
  })

  it('circuit breaker suspends on loop detection', async () => {
    const breaker = new CircuitBreaker({ maxSteps: 100, maxRetriesPerTask: 3, loopDetectionWindow: 6, loopThreshold: 2 })

    // Pattern A, B repeated 3 times (window=6, threshold=2 means 2 consecutive repeats of 2-action pattern)
    breaker.recordStep('A')
    breaker.recordStep('B')
    breaker.recordStep('A')
    breaker.recordStep('B')
    breaker.recordStep('A')
    breaker.recordStep('B')

    expect(breaker.getState().loopDetected).toBe(true)
    expect(breaker.getState().suspended).toBe(true)
  })

  it('subprocess with circuit breaker timeout', async () => {
    const procManager = new SubprocessManager(5)
    const breaker = new CircuitBreaker({ maxSteps: 10 })

    const handle = await procManager.spawn('sleep', ['10'], { timeoutMs: 100 })
    breaker.recordStep('spawn sleep', 'Subprocess')

    await handle.waitForExit()
    expect(handle.status).toBe('timeout')

    // Circuit breaker should still be functional
    expect(breaker.getState().suspended).toBe(false)
  })

  it('router-worker with checkpoint and circuit breaker', async () => {
    const manager = new RouterWorkerManager()
    const breaker = new CircuitBreaker({ maxSteps: 10, maxRetriesPerTask: 2 })

    // Register a worker that simulates a long task
    manager.registerWorker('build', async (task: RouterTask) => {
      breaker.recordStep('build task', task.type)
      await new Promise(r => setTimeout(r, 50))
      return { taskId: task.id, success: true, output: 'build complete', completedAt: Date.now() }
    })

    // Save checkpoint before dispatch
    manager.saveCheckpoint({
      taskId: 'build-1',
      state: { progress: 0 },
      messages: 'Build started',
      context: { branch: 'main' },
      serializedAt: Date.now()
    })

    // Dispatch task
    manager.dispatchTask({
      id: 'build-1',
      type: 'build',
      payload: { target: 'release' },
      priority: 'high',
      createdAt: Date.now()
    })

    // Wait for completion
    await new Promise(r => setTimeout(r, 100))

    // Verify checkpoint exists
    const cp = manager.loadCheckpoint('build-1')
    expect(cp).not.toBeNull()
    expect(cp?.taskId).toBe('build-1')
  })

  it('dead letter queue captures failed retries', async () => {
    const breaker = new CircuitBreaker({ maxSteps: 100, maxRetriesPerTask: 3 })

    // Simulate a task that keeps failing
    for (let i = 0; i < 5; i++) {
      const check = breaker.recordRetry('flaky-task')
      if (check.shouldStop) break
    }

    const deadLetters = breaker.getDeadLetters()
    expect(deadLetters).toHaveLength(1)
    expect(deadLetters[0].taskId).toBe('flaky-task')
    expect(deadLetters[0].retryCount).toBe(1)
  })

  it('parallel execution with subprocess monitoring', async () => {
    const procManager = new SubprocessManager(3)
    const caller = new ParallelFunctionCaller({ maxConcurrency: 2, timeoutMs: 5000 })

    // Create a tool that spawns a subprocess
    const echoTool = new (class extends BaseTool {
      readonly name = 'echo'
      readonly description = 'Echo tool'
      readonly category = 'execution' as const
      readonly readOnly = true
      readonly dangerous = false
      readonly inputSchema = { type: 'object' }

      async execute(input: unknown, _ctx: ExecutionContext): Promise<ToolResult> {
        const text = (input as Record<string, unknown>)?.text ?? 'hello'
        const handle = await procManager.spawn('echo', [String(text)])
        await handle.waitForExit()
        const output = handle.output.filter(c => c.type === 'stdout').map(c => c.data.trim()).join(' ')
        return this.success(output)
      }
    })()

    const tools = new Map([['echo', echoTool]])
    const toolUses: ToolUseBlock[] = [
      { id: 'e1', name: 'echo', input: { text: 'hello' } },
      { id: 'e2', name: 'echo', input: { text: 'world' } }
    ]

    const result = await caller.callParallel(toolUses, tools, mockCtx)
    expect(result.results).toHaveLength(2)
    expect(result.results[0].content).toContain('hello')
    expect(result.results[1].content).toContain('world')
    // Give time for subprocess cleanup
    await new Promise(r => setTimeout(r, 50))
    expect(procManager.getActiveCount()).toBe(0)
  })

  it('pub/sub events coordinate with circuit breaker', async () => {
    const manager = new RouterWorkerManager()
    const breaker = new CircuitBreaker({ maxSteps: 10 })
    const events: string[] = []

    manager.getPubSub().subscribe('task.dispatched', () => {
      breaker.recordStep('task dispatched')
      events.push('dispatched')
    })
    manager.getPubSub().subscribe('task.completed', () => {
      breaker.recordStep('task completed')
      events.push('completed')
    })
    manager.getPubSub().subscribe('task.failed', () => {
      breaker.recordStep('task failed')
      events.push('failed')
    })

    manager.registerWorker('test', async (task: RouterTask) => {
      breaker.recordStep('worker executing', task.type)
      return { taskId: task.id, success: true, output: 'ok', completedAt: Date.now() }
    })

    manager.dispatchTask({ id: 't1', type: 'test', payload: {}, priority: 'normal', createdAt: Date.now() })
    await new Promise(r => setTimeout(r, 50))

    expect(events).toContain('dispatched')
    expect(events).toContain('completed')
    expect(breaker.getState().suspended).toBe(false)
  })
})
