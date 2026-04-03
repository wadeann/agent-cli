import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ParallelFunctionCaller } from '../../blocking/ParallelFunctionCaller.js'
import { BaseTool } from '../../../tools/base.js'
import type { ToolUseBlock } from '../../../tools/orchestrator/types.js'
import type { ExecutionContext, ToolResult } from '../../../providers/base/types.js'

function createMockTool(name: string, delayMs = 10, shouldFail = false): BaseTool {
  const tool = new (class extends BaseTool {
    readonly name = name
    readonly description = `Mock ${name} tool`
    readonly category = 'execution' as const
    readonly readOnly = true
    readonly dangerous = false
    readonly inputSchema = { type: 'object' }

    async execute(_input: unknown, _context: ExecutionContext): Promise<ToolResult> {
      await new Promise(r => setTimeout(r, delayMs))
      if (shouldFail) return this.failure(`${name} failed`)
      return this.success(`${name} result`)
    }
  })()
  return tool
}

const mockContext: ExecutionContext = { cwd: '/test', env: {}, sessionId: 'test' }

describe('ParallelFunctionCaller', () => {
  let caller: ParallelFunctionCaller

  beforeEach(() => {
    caller = new ParallelFunctionCaller({ maxConcurrency: 5, timeoutMs: 5000 })
  })

  it('executes single tool sequentially', async () => {
    const tools = new Map([['read', createMockTool('read', 10)]])
    const toolUses: ToolUseBlock[] = [{ id: 't1', name: 'read', input: {} }]
    const result = await caller.callParallel(toolUses, tools, mockContext)
    expect(result.concurrent).toBe(false)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].content).toBe('read result')
    expect(result.results[0].isError).toBe(false)
  })

  it('executes multiple tools concurrently', async () => {
    const tools = new Map([
      ['read', createMockTool('read', 50)],
      ['write', createMockTool('write', 50)],
      ['bash', createMockTool('bash', 50)]
    ])
    const toolUses: ToolUseBlock[] = [
      { id: 't1', name: 'read', input: {} },
      { id: 't2', name: 'write', input: {} },
      { id: 't3', name: 'bash', input: {} }
    ]
    const start = Date.now()
    const result = await caller.callParallel(toolUses, tools, mockContext)
    const duration = Date.now() - start
    expect(result.concurrent).toBe(true)
    expect(result.results).toHaveLength(3)
    // Concurrent execution should take ~50ms, not ~150ms
    expect(duration).toBeLessThan(100)
  })

  it('handles tool failures gracefully', async () => {
    const tools = new Map([
      ['read', createMockTool('read', 10)],
      ['fail', createMockTool('fail', 10, true)]
    ])
    const toolUses: ToolUseBlock[] = [
      { id: 't1', name: 'read', input: {} },
      { id: 't2', name: 'fail', input: {} }
    ]
    const result = await caller.callParallel(toolUses, tools, mockContext)
    expect(result.results).toHaveLength(2)
    expect(result.results[0].isError).toBe(false)
    expect(result.results[1].isError).toBe(true)
    expect(result.results[1].content).toBe('fail failed')
  })

  it('handles missing tool', async () => {
    const tools = new Map([['read', createMockTool('read', 10)]])
    const toolUses: ToolUseBlock[] = [{ id: 't1', name: 'nonexistent', input: {} }]
    const result = await caller.callParallel(toolUses, tools, mockContext)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].isError).toBe(true)
    expect(result.results[0].content).toContain('not found')
  })

  it('respects max concurrency', async () => {
    const limitedCaller = new ParallelFunctionCaller({ maxConcurrency: 2, timeoutMs: 5000 })
    let concurrentCount = 0
    let maxConcurrent = 0

    const tool = new (class extends BaseTool {
      readonly name = 'track'
      readonly description = 'Track concurrency'
      readonly category = 'execution' as const
      readonly readOnly = true
      readonly dangerous = false
      readonly inputSchema = { type: 'object' }

      async execute(_input: unknown, _context: ExecutionContext): Promise<ToolResult> {
        concurrentCount++
        maxConcurrent = Math.max(maxConcurrent, concurrentCount)
        await new Promise(r => setTimeout(r, 50))
        concurrentCount--
        return this.success('done')
      }
    })()

    const tools = new Map([['track', tool]])
    const toolUses: ToolUseBlock[] = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, name: 'track', input: {} }))
    await limitedCaller.callParallel(toolUses, tools, mockContext)
    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })

  it('handles tool timeout', async () => {
    const slowTool = new (class extends BaseTool {
      readonly name = 'slow'
      readonly description = 'Slow tool'
      readonly category = 'execution' as const
      readonly readOnly = true
      readonly dangerous = false
      readonly inputSchema = { type: 'object' }

      async execute(_input: unknown, _context: ExecutionContext): Promise<ToolResult> {
        await new Promise(() => {})
        return this.success('done')
      }
    })()

    const fastCaller = new ParallelFunctionCaller({ maxConcurrency: 5, timeoutMs: 50 })
    const tools = new Map([['slow', slowTool]])
    const toolUses: ToolUseBlock[] = [{ id: 't1', name: 'slow', input: {} }]
    const result = await fastCaller.callParallel(toolUses, tools, mockContext)
    expect(result.results[0].isError).toBe(true)
    expect(result.results[0].content).toContain('timed out')
  })

  it('returns duration for concurrent execution', async () => {
    const tools = new Map([
      ['a', createMockTool('a', 20)],
      ['b', createMockTool('b', 20)]
    ])
    const toolUses: ToolUseBlock[] = [
      { id: 't1', name: 'a', input: {} },
      { id: 't2', name: 'b', input: {} }
    ]
    const result = await caller.callParallel(toolUses, tools, mockContext)
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(result.duration).toBeLessThan(100)
  })
})
