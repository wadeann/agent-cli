// 交互式精炼系统 - 尝试-失败-调整反馈循环

export interface RefinementAttempt {
  attempt: number
  action: string
  result: 'success' | 'failure' | 'partial'
  feedback: string
  timestamp: number
  strategy: string
}

export interface RefinementState {
  goal: string
  attempts: RefinementAttempt[]
  maxAttempts: number
  currentStrategy: string
  strategies: string[]
}

export class InteractiveRefiner {
  private state: RefinementState

  constructor(goal: string, options: { maxAttempts?: number; strategies?: string[] } = {}) {
    this.state = {
      goal,
      attempts: [],
      maxAttempts: options.maxAttempts ?? 5,
      currentStrategy: options.strategies?.[0] ?? 'default',
      strategies: options.strategies ?? ['default']
    }
  }

  recordAttempt(action: string, success: boolean, feedback: string): RefinementAttempt {
    const attempt: RefinementAttempt = {
      attempt: this.state.attempts.length + 1,
      action,
      result: success ? 'success' : 'failure',
      feedback,
      timestamp: Date.now(),
      strategy: this.state.currentStrategy
    }
    this.state.attempts.push(attempt)
    return attempt
  }

  shouldRetry(): boolean {
    return this.state.attempts.length < this.state.maxAttempts &&
      this.state.attempts[this.state.attempts.length - 1]?.result !== 'success'
  }

  getNextStrategy(): string {
    const failedStrategies = new Set(
      this.state.attempts
        .filter(a => a.result === 'failure')
        .map(a => a.strategy)
    )

    for (const strategy of this.state.strategies) {
      if (!failedStrategies.has(strategy)) {
        this.state.currentStrategy = strategy
        return strategy
      }
    }

    return this.state.strategies[this.state.strategies.length - 1] ?? 'default'
  }

  getFeedbackSummary(): string {
    if (this.state.attempts.length === 0) return 'No attempts yet.'

    const lastAttempt = this.state.attempts[this.state.attempts.length - 1]
    const failures = this.state.attempts.filter(a => a.result === 'failure')

    let summary = `Attempt ${lastAttempt.attempt}/${this.state.maxAttempts}: ${lastAttempt.result}\n`
    summary += `Last feedback: ${lastAttempt.feedback}\n`

    if (failures.length > 1) {
      summary += `\nPrevious failures:\n`
      for (const f of failures.slice(0, -1)) {
        summary += `  Attempt ${f.attempt}: ${f.feedback}\n`
      }
    }

    return summary
  }

  isComplete(): boolean {
    return this.state.attempts[this.state.attempts.length - 1]?.result === 'success'
  }

  getState(): RefinementState {
    return { ...this.state, attempts: [...this.state.attempts] }
  }

  reset(): void {
    this.state.attempts = []
  }
}
