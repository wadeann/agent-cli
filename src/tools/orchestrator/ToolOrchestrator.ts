// 主工具编排器

import type { 
  ToolUseBlock, 
  ToolResultBlock, 
  OrchestrationOptions,
  ToolExecutionTask
} from './types.js'
import { BaseTool } from '../../tools/base.js'
import { ExecutionPlanner } from './ExecutionPlanner.js'

interface CanUseToolResult {
  granted: boolean
  reason?: string
}

type CanUseToolFn = (tool: BaseTool, input: Record<string, unknown>) => Promise<CanUseToolResult>

export class ToolOrchestrator {
  private planner = new ExecutionPlanner()
  
  /**
   * 编排工具执行
   */
  async orchestrate(
    toolUses: ToolUseBlock[],
    availableTools: Map<string, BaseTool>,
    canUseTool: CanUseToolFn,
    options: Partial<OrchestrationOptions> = {}
  ): Promise<ToolResultBlock[]> {
    if (toolUses.length === 0) return []
    
    // 创建执行计划
    const plan = this.planner.createPlan(toolUses, availableTools, options as OrchestrationOptions)
    
    // 按阶段执行
    const results: ToolResultBlock[] = []
    
    for (const stage of plan.stages) {
      if (stage.canRunInParallel) {
        // 并行执行阶段
        const stageResults = await this.executeStageParallel(
          stage.tasks,
          availableTools,
          canUseTool,
          options as OrchestrationOptions
        )
        results.push(...stageResults)
      } else {
        // 串行执行阶段
        const stageResults = await this.executeStageSerial(
          stage.tasks,
          availableTools,
          canUseTool,
          options as OrchestrationOptions
        )
        results.push(...stageResults)
      }
    }
    
    return results
  }
  
  /**
   * 并行执行阶段
   */
  private async executeStageParallel(
    tasks: ToolExecutionTask[],
    availableTools: Map<string, BaseTool>,
    canUseTool: CanUseToolFn,
    options: OrchestrationOptions
  ): Promise<ToolResultBlock[]> {
    const maxConcurrency = options.maxConcurrency ?? 10
    
    // 分批执行以控制并发数
    const batches: ToolExecutionTask[][] = []
    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      batches.push(tasks.slice(i, i + maxConcurrency))
    }
    
    const results: ToolResultBlock[] = []
    
    for (const batch of batches) {
      // 并行执行当前批次
      const batchPromises = batch.map(task => 
        this.executeSingleTool(task, availableTools, canUseTool, options)
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    return results
  }
  
  /**
   * 串行执行阶段
   */
  private async executeStageSerial(
    tasks: ToolExecutionTask[],
    availableTools: Map<string, BaseTool>,
    canUseTool: CanUseToolFn,
    options: OrchestrationOptions
  ): Promise<ToolResultBlock[]> {
    const results: ToolResultBlock[] = []
    
    for (const task of tasks) {
      const result = await this.executeSingleTool(
        task, 
        availableTools, 
        canUseTool, 
        options
      )
      results.push(result)
    }
    
    return results
  }
  
  /**
   * 执行单个工具
   */
  private async executeSingleTool(
    task: ToolExecutionTask,
    availableTools: Map<string, BaseTool>,
    canUseTool: CanUseToolFn,
    options: OrchestrationOptions
  ): Promise<ToolResultBlock> {
    const tool = availableTools.get(task.tool.name)
    if (!tool) {
      return {
        toolUseId: task.id,
        content: `Tool ${task.tool.name} not found`,
        isError: true
      }
    }
    
    // 检查权限
    const permission = await canUseTool(tool, task.input)
    if (!permission.granted) {
      return {
        toolUseId: task.id,
        content: `Permission denied: ${permission.reason}`,
        isError: true
      }
    }
    
    // 执行工具
    try {
      const timeoutMs = options.timeoutMs ?? 30000
      const env: Record<string, string> = {}
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) env[key] = value
      }
      const result = await Promise.race([
        tool.execute(task.input, { 
          cwd: process.cwd(),
          env,
          sessionId: 'session-' + Date.now()
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        )
      ]) as { success: boolean; content: string; error?: string }
      
      return {
        toolUseId: task.id,
        content: result.success ? result.content : result.error || 'Unknown error',
        isError: !result.success
      }
    } catch (err: unknown) {
      return {
        toolUseId: task.id,
        content: err instanceof Error ? err.message : 'Execution failed',
        isError: true,
      }
    }
  }
}
