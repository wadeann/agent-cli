// 资源管理类型定义

export interface ResourceBudget {
  maxTokens: number
  maxCost: number      // USD
  maxTime: number      // milliseconds
  maxSteps: number
}

export interface TaskComplexity {
  estimatedTokens: number
  estimatedCost: number
  estimatedSteps: number
  requiresVision: boolean
  requiresCodeExecution: boolean
  requiresWebSearch: boolean
  confidence: number   // 0-1, estimation confidence
}

export interface ResourceAllocation {
  model: string
  budget: ResourceBudget
  priority: 'low' | 'medium' | 'high' | 'critical'
  timeout: number
  retryPolicy: {
    maxAttempts: number
    baseDelayMs: number
    maxDelayMs: number
  }
}

export interface ExecutionContext {
  cwd: string
  env: Record<string, string>
  sessionId: string
  userId?: string
  availableModels: string[]
}
