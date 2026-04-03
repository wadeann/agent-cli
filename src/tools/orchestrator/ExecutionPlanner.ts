// 执行计划器

import type { 
  ToolUseBlock, 
  ExecutionPlan, 
  ExecutionStage, 
  OrchestrationOptions,
  ToolExecutionTask
} from './types.js'
import { BaseTool } from '../../tools/base.js'
import { DependencyAnalyzer } from './DependencyAnalyzer.js'

export class ExecutionPlanner {
  private dependencyAnalyzer = new DependencyAnalyzer()
  
  /**
   * 创建执行计划
   */
  createPlan(
    toolUses: ToolUseBlock[],
    availableTools: Map<string, BaseTool>,
    _options: OrchestrationOptions = {} as OrchestrationOptions
  ): ExecutionPlan {
    const { independent, sequential } = this.dependencyAnalyzer.analyzeDependencies(
      toolUses, 
      availableTools
    )
    
    const stages: ExecutionStage[] = []
    let totalTime = 0
    
    // 处理独立任务（可以并行执行）
    if (independent.length > 0) {
      const independentTasks: ToolExecutionTask[] = independent.map(tu => ({
        id: tu.id,
        tool: availableTools.get(tu.name)!,
        input: tu.input,
        priority: 1,
        dependencies: [],
        canRetry: true
      }))
      
      stages.push({
        tasks: independentTasks,
        canRunInParallel: true,
        estimatedTime: this.estimateStageTime(independentTasks, true)
      })
      
      totalTime += stages[stages.length - 1].estimatedTime
    }
    
    // 处理顺序任务
    for (const sequentialGroup of sequential) {
      const tasks: ToolExecutionTask[] = sequentialGroup.map(tu => ({
        id: tu.id,
        tool: availableTools.get(tu.name)!,
        input: tu.input,
        priority: 2,
        dependencies: [],  // 依赖将在执行时动态计算
        canRetry: true
      }))
      
      stages.push({
        tasks,
        canRunInParallel: false,
        estimatedTime: this.estimateStageTime(tasks, false)
      })
      
      totalTime += stages[stages.length - 1].estimatedTime
    }
    
    return {
      stages,
      totalEstimatedTime: totalTime
    }
  }
  
  /**
   * 估算阶段执行时间
   */
  private estimateStageTime(tasks: ToolExecutionTask[], canParallel: boolean): number {
    if (tasks.length === 0) return 0
    
    // 不同工具类型的基础时间估算（毫秒）
    const baseTimes: Record<string, number> = {
      'Read': 50,
      'Write': 100,
      'Edit': 150,
      'Bash': 500,
      'Glob': 300,
      'Grep': 400,
      'WebFetch': 2000,
      'WebSearch': 3000,
      'Agent': 5000
    }
    
    let maxTime = 0
    let totalTime = 0
    
    for (const task of tasks) {
      const baseTime = baseTimes[task.tool.name] || 100
      // 添加一些随机性来模拟真实世界的变化
      const variation = Math.random() * 0.4 + 0.8  // 0.8-1.2倍
      const estimated = baseTime * variation
      
      totalTime += estimated
      if (estimated > maxTime) maxTime = estimated
    }
    
    if (canParallel && tasks.length > 1) {
      // 并行执行时间取决于最慢的任务
      return maxTime
    } else {
      // 串行执行时间是所有任务时间的和
      return totalTime
    }
  }
}
