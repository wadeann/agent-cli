// 并行函数调用 - 单回合内并发执行多个工具

import type { ToolUseBlock, ToolResultBlock } from '../../tools/orchestrator/types.js'
import type { BaseTool } from '../../tools/base.js'
import type { ExecutionContext } from '../../providers/base/types.js'

export interface ParallelCallResult {
  results: ToolResultBlock[]
  duration: number
  concurrent: boolean
}

export class ParallelFunctionCaller {
  private maxConcurrency: number
  private timeoutMs: number

  constructor(options: { maxConcurrency?: number; timeoutMs?: number } = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 10
    this.timeoutMs = options.timeoutMs ?? 30000
  }

  async callParallel(
    toolUses: ToolUseBlock[],
    availableTools: Map<string, BaseTool>,
    context: ExecutionContext
  ): Promise<ParallelCallResult> {
    if (toolUses.length <= 1) {
      const results = await this.executeSequential(toolUses, availableTools, context)
      return { results, duration: 0, concurrent: false }
    }

    const start = Date.now()
    const results: ToolResultBlock[] = []

    // 分批并发执行
    for (let i = 0; i < toolUses.length; i += this.maxConcurrency) {
      const batch = toolUses.slice(i, i + this.maxConcurrency)
      const batchResults = await Promise.allSettled(
        batch.map(tu => this.executeSingle(tu, availableTools, context))
      )
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({
            toolUseId: (result.reason as any)?.toolUseId ?? 'unknown',
            content: result.reason instanceof Error ? result.reason.message : 'Execution failed',
            isError: true
          })
        }
      }
    }

    return { results, duration: Date.now() - start, concurrent: true }
  }

  private async executeSingle(
    toolUse: ToolUseBlock,
    availableTools: Map<string, BaseTool>,
    context: ExecutionContext
  ): Promise<ToolResultBlock> {
    const tool = availableTools.get(toolUse.name)
    if (!tool) {
      return { toolUseId: toolUse.id, content: `Tool ${toolUse.name} not found`, isError: true }
    }

    try {
      const result = await Promise.race([
        tool.execute(toolUse.input, context),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Tool ${toolUse.name} timed out`)), this.timeoutMs)
        )
      ])

      return {
        toolUseId: toolUse.id,
        content: result.success ? result.content : result.error ?? 'Unknown error',
        isError: !result.success
      }
    } catch (err: unknown) {
      return {
        toolUseId: toolUse.id,
        content: err instanceof Error ? err.message : 'Execution failed',
        isError: true
      }
    }
  }

  private async executeSequential(
    toolUses: ToolUseBlock[],
    availableTools: Map<string, BaseTool>,
    context: ExecutionContext
  ): Promise<ToolResultBlock[]> {
    const results: ToolResultBlock[] = []
    for (const tu of toolUses) {
      results.push(await this.executeSingle(tu, availableTools, context))
    }
    return results
  }
}
