// 任务系统类型定义

export type TaskStatus =
  | 'pending'
  | 'scheduled'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface TaskResult {
  output: string
  success: boolean
  error?: string
  metadata?: Record<string, unknown>
}

export interface Checkpoint {
  id: string
  taskId: string
  description: string
  state: Record<string, unknown>
  createdAt: number
}

export interface TaskV2 {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dependencies: string[]
  subtasks: string[]
  result?: TaskResult
  checkpoints: Checkpoint[]
  createdAt: number
  updatedAt: number
  maxRetries: number
  retryCount: number
}

export interface TaskGraph {
  nodes: Map<string, TaskV2>
  edges: Map<string, string[]>
}

export interface ScheduleResult {
  orderedTasks: TaskV2[]
  hasCycle: boolean
  blockedTasks: string[]
}
