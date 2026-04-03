// 防阻塞系统类型定义

export type ProcessStatus = 'running' | 'completed' | 'failed' | 'interrupted' | 'timeout'

export type TaskState = 'pending' | 'dispatched' | 'running' | 'completed' | 'failed' | 'dead_letter' | 'suspended'

export interface StreamChunk {
  type: 'stdout' | 'stderr'
  data: string
  timestamp: number
}

export interface SubprocessHandle {
  pid: number
  status: ProcessStatus
  output: StreamChunk[]
  startTime: number
  endTime?: number
  interrupt(): Promise<void>
  waitForExit(): Promise<number>
}

export interface CircuitBreakerConfig {
  maxSteps: number
  maxRetriesPerTask: number
  loopDetectionWindow: number
  loopThreshold: number
  timeoutMs: number
  suspendOnLoop: boolean
}

export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  maxSteps: 100,
  maxRetriesPerTask: 5,
  loopDetectionWindow: 10,
  loopThreshold: 3,
  timeoutMs: 300000,
  suspendOnLoop: true
}

export interface RouterTask {
  id: string
  type: string
  payload: Record<string, unknown>
  priority: 'low' | 'normal' | 'high' | 'critical'
  createdAt: number
  timeoutMs?: number
}

export interface WorkerResult {
  taskId: string
  success: boolean
  output: string
  error?: string
  completedAt: number
}

export interface CheckpointData {
  taskId: string
  state: Record<string, unknown>
  messages: string
  context: Record<string, unknown>
  serializedAt: number
  webhookUrl?: string
}

export interface DeadLetterEntry {
  taskId: string
  originalTask: RouterTask
  failureReason: string
  retryCount: number
  maxRetries: number
  firstFailedAt: number
  lastFailedAt: number
}

export interface PubSubMessage {
  id: string
  topic: string
  data: Record<string, unknown>
  timestamp: number
}
