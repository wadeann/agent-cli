// 工具依赖分析器

import type { ToolUseBlock } from './types.js'
import { BaseTool } from '../../tools/base.js'

export class DependencyAnalyzer {
  /**
   * 分析工具调用之间的依赖关系
   */
  analyzeDependencies(
    toolUses: ToolUseBlock[],
    availableTools: Map<string, BaseTool>
  ): { independent: ToolUseBlock[]; sequential: ToolUseBlock[][] } {
    if (toolUses.length === 0) {
      return { independent: [], sequential: [] }
    }
    
    // 构建依赖图
    const dependencyMap = new Map<string, Set<string>>()
    toolUses.forEach(tu => dependencyMap.set(tu.id, new Set()))
    
    // 分析每个工具的输入输出依赖
    for (let i = 0; i < toolUses.length; i++) {
      const current = toolUses[i]
      const currentTool = availableTools.get(current.name)
      
      if (!currentTool) continue
      
      // 检查当前工具的输入是否依赖之前工具的输出
      for (let j = 0; j < i; j++) {
        const previous = toolUses[j]
        if (this.hasDependency(current.input, previous.id)) {
          if (!dependencyMap.get(current.id)) {
            dependencyMap.set(current.id, new Set())
          }
          dependencyMap.get(current.id)!.add(previous.id)
        }
      }
    }
    
    // 拓扑排序来识别可以并行执行的组
    const stages: ToolUseBlock[][] = []
    const remaining = new Set(toolUses.map(tu => tu.id))
    const processed = new Set<string>()
    
    while (remaining.size > 0) {
      const stage: ToolUseBlock[] = []
      
      for (const tuId of remaining) {
        const dependencies = dependencyMap.get(tuId) || new Set()
        // 检查所有依赖是否已经处理
        const allDepsProcessed = [...dependencies].every(dep => processed.has(dep))
        
        if (allDepsProcessed) {
          const toolUse = toolUses.find(tu => tu.id === tuId)!
          if (toolUse) stage.push(toolUse)
        }
      }
      
      if (stage.length === 0) {
        // 防止死锁 - 如果没有可以执行的任务，强制执行一个
        const nextId = [...remaining][0]
        const toolUse = toolUses.find(tu => tu.id === nextId)!
        if (toolUse) stage.push(toolUse)
      }
      
      // 标记本阶段任务为已处理
      for (const tu of stage) {
        remaining.delete(tu.id)
        processed.add(tu.id)
      }
      
      stages.push(stage)
    }
    
    // 将第一阶段的独立任务分离出来（如果它们没有依赖）
    const firstStage = stages[0] || []
    const independent: ToolUseBlock[] = []
    const sequentialStages: ToolUseBlock[][] = []
    
    for (const tu of firstStage) {
      const deps = dependencyMap.get(tu.id) || new Set()
      if (deps.size === 0) {
        independent.push(tu)
      }
    }
    
    // 剩余的任务按顺序阶段组织
    const nonIndependentFirstStage = firstStage.filter(tu => 
      (dependencyMap.get(tu.id) || new Set()).size !== 0
    )
    
    if (nonIndependentFirstStage.length > 0) {
      sequentialStages.push(nonIndependentFirstStage)
    }
    
    // 添加剩余的阶段
    for (let i = 1; i < stages.length; i++) {
      sequentialStages.push(stages[i])
    }
    
    return { independent, sequential: sequentialStages }
  }
  
  /**
   * 检查输入是否依赖特定的工具ID
   */
  private hasDependency(input: Record<string, unknown>, toolId: string): boolean {
    const inputStr = JSON.stringify(input)
    return inputStr.includes(`"toolUseId":"${toolId}"`) || 
           inputStr.includes(`"toolUseId": "${toolId}"`) ||
           inputStr.includes(`"${toolId}"`) // 简单的ID引用检测
  }
}
