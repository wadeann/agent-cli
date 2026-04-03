// 工具编排类型

import { BaseTool } from '../../tools/base.js'

export interface ToolUseBlock {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  toolUseId: string
  content: string
  isError?: boolean
}

export interface ToolExecutionTask {
  id: string
  tool: BaseTool
  input: Record<string, unknown>
  priority: number
  dependencies: string[]  // 依赖的任务ID
  canRetry: boolean
}

export interface ExecutionPlan {
  stages: ExecutionStage[]
  totalEstimatedTime: number
}

export interface ExecutionStage {
  tasks: ToolExecutionTask[]
  canRunInParallel: boolean
  estimatedTime: number
}

export interface DependencyGraph {
  nodes: Map<string, ToolExecutionTask>
  edges: Map<string, string[]>  // taskId -> [dependentTaskId]
}

export interface OrchestrationOptions {
  maxConcurrency: number
  timeoutMs: number
  retryFailed: boolean
}
