// 防死循环断路器 - 步数限制 + 循环检测 + 强制挂起

import type { CircuitBreakerConfig, DeadLetterEntry } from './types.js'
import { DEFAULT_CIRCUIT_BREAKER } from './types.js'

export interface StepRecord {
  stepNumber: number
  action: string
  toolUsed?: string
  timestamp: number
  hash: string
}

export interface CircuitBreakerState {
  stepCount: number
  retryCount: Map<string, number>
  recentActions: string[]
  loopDetected: boolean
  suspended: boolean
  suspendedAt?: number
  suspensionReason?: string
}

export type SuspensionHandler = (reason: string, state: CircuitBreakerState) => Promise<void>

export class CircuitBreaker {
  private config: CircuitBreakerConfig
  private state: CircuitBreakerState
  private stepHistory: StepRecord[] = []
  private onSuspend?: SuspensionHandler
  private deadLetters: DeadLetterEntry[] = []

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER, ...config }
    this.state = {
      stepCount: 0,
      retryCount: new Map(),
      recentActions: [],
      loopDetected: false,
      suspended: false
    }
  }

  recordStep(action: string, toolUsed?: string): { shouldStop: boolean; reason?: string } {
    if (this.state.suspended) {
      return { shouldStop: true, reason: 'Circuit breaker suspended' }
    }

    this.state.stepCount++
    this.state.recentActions.push(action)

    if (this.state.recentActions.length > this.config.loopDetectionWindow) {
      this.state.recentActions.shift()
    }

    const hash = this.hashAction(action)
    this.stepHistory.push({
      stepNumber: this.state.stepCount,
      action,
      toolUsed,
      timestamp: Date.now(),
      hash
    })

    // Check max steps
    if (this.state.stepCount >= this.config.maxSteps) {
      this.suspend(`Max steps reached (${this.config.maxSteps})`)
      return { shouldStop: true, reason: `Max steps exceeded: ${this.config.maxSteps}` }
    }

    // Check loop detection
    if (this.detectLoop()) {
      this.state.loopDetected = true
      if (this.config.suspendOnLoop) {
        this.suspend('Loop detected - agent is repeating the same actions')
      }
      return { shouldStop: true, reason: 'Loop detected' }
    }

    return { shouldStop: false }
  }

  recordRetry(taskId: string): { shouldStop: boolean; reason?: string } {
    const count = (this.state.retryCount.get(taskId) ?? 0) + 1
    this.state.retryCount.set(taskId, count)

    if (count >= this.config.maxRetriesPerTask) {
      this.addToDeadLetter(taskId, `Max retries exceeded (${count}/${this.config.maxRetriesPerTask})`)
      return { shouldStop: true, reason: `Max retries exceeded for task ${taskId}` }
    }

    return { shouldStop: false }
  }

  recordTimeout(taskId: string, timeoutMs: number): void {
    this.addToDeadLetter(taskId, `Timeout after ${timeoutMs}ms`)
  }

  suspend(reason: string): void {
    this.state.suspended = true
    this.state.suspendedAt = Date.now()
    this.state.suspensionReason = reason

    if (this.onSuspend) {
      this.onSuspend(reason, { ...this.state })
    }
  }

  resume(): void {
    this.state.suspended = false
    this.state.suspensionReason = undefined
    this.state.loopDetected = false
  }

  reset(): void {
    this.state = {
      stepCount: 0,
      retryCount: new Map(),
      recentActions: [],
      loopDetected: false,
      suspended: false
    }
    this.stepHistory = []
  }

  getState(): CircuitBreakerState {
    return { ...this.state }
  }

  getStepHistory(): StepRecord[] {
    return [...this.stepHistory]
  }

  getDeadLetters(): DeadLetterEntry[] {
    return [...this.deadLetters]
  }

  setSuspendHandler(handler: SuspensionHandler): void {
    this.onSuspend = handler
  }

  private detectLoop(): boolean {
    const recent = this.state.recentActions
    if (recent.length < this.config.loopThreshold * 2) return false

    const window = this.config.loopThreshold
    for (let i = 0; i <= recent.length - window * 2; i++) {
      const segment1 = recent.slice(i, i + window).join('|')
      const segment2 = recent.slice(i + window, i + window * 2).join('|')
      if (segment1 === segment2) return true
    }

    return false
  }

  private addToDeadLetter(taskId: string, reason: string): void {
    const existing = this.deadLetters.find(d => d.taskId === taskId)
    if (existing) {
      existing.retryCount++
      existing.lastFailedAt = Date.now()
      existing.failureReason = reason
    } else {
      this.deadLetters.push({
        taskId,
        originalTask: { id: taskId, type: 'unknown', payload: {}, priority: 'normal', createdAt: Date.now() },
        failureReason: reason,
        retryCount: 1,
        maxRetries: this.config.maxRetriesPerTask,
        firstFailedAt: Date.now(),
        lastFailedAt: Date.now()
      })
    }
  }

  private hashAction(action: string): string {
    let hash = 0
    for (let i = 0; i < action.length; i++) {
      const char = action.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }
}
