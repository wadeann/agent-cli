// 结构化错误处理系统

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal'
export type ErrorCategory = 'provider' | 'tool' | 'network' | 'config' | 'memory' | 'security' | 'system'

export interface AgentError extends Error {
  code: string
  severity: ErrorSeverity
  category: ErrorCategory
  context?: Record<string, unknown>
  timestamp: number
  recoverable: boolean
  suggestion?: string
}

export class BaseAgentError extends Error implements AgentError {
  readonly code: string
  readonly severity: ErrorSeverity
  readonly category: ErrorCategory
  readonly context?: Record<string, unknown>
  readonly timestamp: number
  readonly recoverable: boolean
  readonly suggestion?: string

  constructor(code: string, message: string, options: {
    severity?: ErrorSeverity
    category?: ErrorCategory
    context?: Record<string, unknown>
    recoverable?: boolean
    suggestion?: string
    cause?: Error
  } = {}) {
    super(message, { cause: options.cause })
    this.name = this.constructor.name
    this.code = code
    this.severity = options.severity ?? 'error'
    this.category = options.category ?? 'system'
    this.context = options.context
    this.timestamp = Date.now()
    this.recoverable = options.recoverable ?? true
    this.suggestion = options.suggestion
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      name: this.name,
      message: this.message,
      severity: this.severity,
      category: this.category,
      context: this.context,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      suggestion: this.suggestion,
      stack: this.stack
    }
  }
}

// Provider errors
export class ProviderError extends BaseAgentError {
  constructor(message: string, options?: ConstructorParameters<typeof BaseAgentError>[2]) {
    super('PROVIDER_ERROR', message, { ...options, category: 'provider' })
  }
}

export class ModelNotFoundError extends ProviderError {
  constructor(model: string) {
    super(`Model '${model}' not found`, {
      severity: 'error',
      context: { model },
      suggestion: 'Run `agent models` to see available models',
      recoverable: true
    })
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(provider: string) {
    super(`Authentication failed for ${provider}`, {
      severity: 'fatal',
      context: { provider },
      suggestion: `Check your API key in ~/.agent-cli/config.json`,
      recoverable: false
    })
  }
}

// Tool errors
export class ToolError extends BaseAgentError {
  constructor(message: string, options?: ConstructorParameters<typeof BaseAgentError>[2]) {
    super('TOOL_ERROR', message, { ...options, category: 'tool' })
  }
}

export class ToolPermissionError extends ToolError {
  constructor(tool: string) {
    super(`Permission denied for tool: ${tool}`, {
      severity: 'warning',
      context: { tool },
      suggestion: 'Check tool permissions in security config',
      recoverable: false
    })
  }
}

export class ToolTimeoutError extends ToolError {
  constructor(tool: string, timeoutMs: number) {
    super(`Tool '${tool}' timed out after ${timeoutMs}ms`, {
      severity: 'warning',
      context: { tool, timeoutMs },
      suggestion: 'Try increasing the timeout or simplifying the request',
      recoverable: true
    })
  }
}

// Network errors
export class NetworkError extends BaseAgentError {
  constructor(message: string, options?: ConstructorParameters<typeof BaseAgentError>[2]) {
    super('NETWORK_ERROR', message, { ...options, category: 'network' })
  }
}

export class RateLimitError extends NetworkError {
  constructor(provider: string, retryAfter?: number) {
    super(`Rate limited by ${provider}`, {
      severity: 'warning',
      context: { provider, retryAfter },
      suggestion: retryAfter ? `Retry after ${retryAfter}s` : 'Wait before retrying',
      recoverable: true
    })
  }
}

// Config errors
export class ConfigError extends BaseAgentError {
  constructor(message: string, options?: ConstructorParameters<typeof BaseAgentError>[2]) {
    super('CONFIG_ERROR', message, { ...options, category: 'config' })
  }
}

// Security errors
export class SecurityError extends BaseAgentError {
  constructor(message: string, options?: ConstructorParameters<typeof BaseAgentError>[2]) {
    super('SECURITY_ERROR', message, { ...options, category: 'security', recoverable: false })
  }
}

// Error reporter
export class ErrorReporter {
  private errors: AgentError[] = []
  private maxHistory: number
  private onFatal?: (error: AgentError) => void

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory
  }

  report(error: AgentError): void {
    this.errors.push(error)
    if (this.errors.length > this.maxHistory) this.errors.shift()

    if (error.severity === 'fatal' && this.onFatal) {
      this.onFatal(error)
    }
  }

  getErrors(severity?: ErrorSeverity): AgentError[] {
    if (severity) return this.errors.filter(e => e.severity === severity)
    return [...this.errors]
  }

  getRecentErrors(count = 10): AgentError[] {
    return this.errors.slice(-count)
  }

  getErrorCount(severity?: ErrorSeverity): number {
    if (severity) return this.errors.filter(e => e.severity === severity).length
    return this.errors.length
  }

  setOnFatal(handler: (error: AgentError) => void): void {
    this.onFatal = handler
  }

  clear(): void {
    this.errors = []
  }

  generateReport(): string {
    const counts = {
      info: this.getErrorCount('info'),
      warning: this.getErrorCount('warning'),
      error: this.getErrorCount('error'),
      fatal: this.getErrorCount('fatal')
    }

    const lines = [
      `Error Report (${this.errors.length} total)`,
      `  Info: ${counts.info}`,
      `  Warning: ${counts.warning}`,
      `  Error: ${counts.error}`,
      `  Fatal: ${counts.fatal}`,
      ''
    ]

    const recent = this.getRecentErrors(5)
    for (const err of recent) {
      lines.push(`[${err.severity.toUpperCase()}] ${err.code}: ${err.message}`)
      if (err.suggestion) lines.push(`  Suggestion: ${err.suggestion}`)
    }

    return lines.join('\n')
  }
}
