// 安全验证器 - 输入验证、命令检查、权限控制

import type { SecurityConfig, ValidationResult, ToolPermission, RateLimitState } from './types.js'
import { DEFAULT_SECURITY_CONFIG } from './types.js'

export class SecurityValidator {
  private config: SecurityConfig
  private rateLimit: RateLimitState
  private permissions: Map<string, ToolPermission> = new Map()

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config }
    this.rateLimit = {
      requestCount: 0,
      tokenCount: 0,
      costAccumulated: 0,
      windowStart: Date.now(),
      hourStart: Date.now()
    }
    for (const perm of this.config.defaultPermissions) {
      this.permissions.set(perm.toolName, perm)
    }
  }

  validateInput(input: string): ValidationResult {
    if (input.length > this.config.maxInputLength) {
      return { valid: false, reason: `Input exceeds max length (${input.length}/${this.config.maxInputLength})`, severity: 'critical' }
    }

    for (const pattern of this.config.deniedPatterns) {
      const regex = new RegExp(pattern, 'i')
      if (regex.test(input)) {
        return { valid: false, reason: `Input matches denied pattern: ${pattern}`, severity: 'critical' }
      }
    }

    return { valid: true, severity: 'info' }
  }

  validateCommand(command: string, args: string[]): ValidationResult {
    if (!this.config.allowedCommands.includes(command)) {
      return { valid: false, reason: `Command '${command}' not in allowed list`, severity: 'critical' }
    }

    const fullCommand = `${command} ${args.join(' ')}`
    for (const pattern of this.config.deniedPatterns) {
      const regex = new RegExp(pattern, 'i')
      if (regex.test(fullCommand)) {
        return { valid: false, reason: `Command matches denied pattern: ${pattern}`, severity: 'critical' }
      }
    }

    return { valid: true, severity: 'info' }
  }

  validateToolAccess(toolName: string): ValidationResult {
    const perm = this.permissions.get(toolName)
    if (!perm) {
      return { valid: false, reason: `No permission configured for tool: ${toolName}`, severity: 'warning' }
    }
    return { valid: true, severity: 'info' }
  }

  checkRateLimit(requestTokens: number, cost: number): ValidationResult {
    const now = Date.now()
    const minuteMs = 60 * 1000
    const hourMs = 60 * 60 * 1000

    // Reset windows if expired
    if (now - this.rateLimit.windowStart > minuteMs) {
      this.rateLimit.requestCount = 0
      this.rateLimit.tokenCount = 0
      this.rateLimit.windowStart = now
    }
    if (now - this.rateLimit.hourStart > hourMs) {
      this.rateLimit.costAccumulated = 0
      this.rateLimit.hourStart = now
    }

    this.rateLimit.requestCount++
    this.rateLimit.tokenCount += requestTokens
    this.rateLimit.costAccumulated += cost

    if (this.rateLimit.requestCount > this.config.rateLimit.requestsPerMinute) {
      return { valid: false, reason: `Rate limit exceeded: ${this.rateLimit.requestCount}/${this.config.rateLimit.requestsPerMinute} requests/min`, severity: 'warning' }
    }
    if (this.rateLimit.tokenCount > this.config.rateLimit.tokensPerMinute) {
      return { valid: false, reason: `Token limit exceeded: ${this.rateLimit.tokenCount}/${this.config.rateLimit.tokensPerMinute} tokens/min`, severity: 'warning' }
    }
    if (this.rateLimit.costAccumulated > this.config.rateLimit.costPerHour) {
      return { valid: false, reason: `Cost limit exceeded: $${this.rateLimit.costAccumulated.toFixed(2)}/$${this.config.rateLimit.costPerHour}/hr`, severity: 'critical' }
    }

    return { valid: true, severity: 'info' }
  }

  setPermission(toolName: string, permission: ToolPermission): void {
    this.permissions.set(toolName, permission)
  }

  revokePermission(toolName: string): void {
    this.permissions.delete(toolName)
  }

  getPermissions(): ToolPermission[] {
    return Array.from(this.permissions.values())
  }

  getRateLimitState(): RateLimitState {
    return { ...this.rateLimit }
  }

  resetRateLimit(): void {
    this.rateLimit = {
      requestCount: 0,
      tokenCount: 0,
      costAccumulated: 0,
      windowStart: Date.now(),
      hourStart: Date.now()
    }
  }

  getConfig(): SecurityConfig {
    return { ...this.config }
  }
}
