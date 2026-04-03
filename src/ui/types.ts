// UI渲染器类型定义

export type MessageType = 'user' | 'assistant' | 'tool' | 'error' | 'system' | 'thinking'

export interface UIMessage {
  id: string
  type: MessageType
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface ToolExecutionUI {
  id: string
  toolName: string
  status: 'pending' | 'running' | 'success' | 'error'
  input: string
  output?: string
  startedAt?: number
  completedAt?: number
}

export interface ProgressState {
  currentStep: number
  totalSteps: number
  message: string
  percentage: number
}

export interface UIState {
  messages: UIMessage[]
  toolExecutions: ToolExecutionUI[]
  progress: ProgressState | null
  isStreaming: boolean
  costSummary?: {
    totalCost: number
    totalTokens: number
    requests: number
  }
}
