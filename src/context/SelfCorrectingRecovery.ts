// 自纠错恢复系统 - 自动检测错误并生成修复建议

import type { AgentError } from '../errors/AgentErrors.js'

export interface FixSuggestion {
  description: string
  confidence: number
  code?: string
  filePath?: string
  line?: number
}

export interface ErrorAnalysis {
  error: AgentError
  rootCause: string
  suggestions: FixSuggestion[]
  autoFixable: boolean
  relatedErrors: string[]
}

export class SelfCorrectingRecovery {
  private errorPatterns: Map<string, { fix: string; confidence: number }> = new Map()

  constructor() {
    this.registerCommonPatterns()
  }

  analyzeError(error: AgentError): ErrorAnalysis {
    const rootCause = this.identifyRootCause(error)
    const suggestions = this.generateSuggestions(error, rootCause)
    const relatedErrors = this.findRelatedErrors(error)

    return {
      error,
      rootCause,
      suggestions,
      autoFixable: suggestions.some(s => s.confidence > 0.8 && s.code),
      relatedErrors
    }
  }

  registerPattern(errorCode: string, fix: string, confidence = 0.9): void {
    this.errorPatterns.set(errorCode, { fix, confidence })
  }

  private registerCommonPatterns(): void {
    this.errorPatterns.set('PROVIDER_ERROR', { fix: 'Check API key and endpoint configuration', confidence: 0.8 })
    this.errorPatterns.set('PROVIDER_AUTH_ERROR', { fix: 'Update API key in config.json', confidence: 0.95 })
    this.errorPatterns.set('MODEL_NOT_FOUND', { fix: 'Use `agent models` to list available models', confidence: 0.95 })
    this.errorPatterns.set('TOOL_ERROR', { fix: 'Check tool permissions and input schema', confidence: 0.7 })
    this.errorPatterns.set('TOOL_TIMEOUT', { fix: 'Increase timeout or simplify the request', confidence: 0.8 })
    this.errorPatterns.set('NETWORK_ERROR', { fix: 'Check internet connection and retry', confidence: 0.6 })
    this.errorPatterns.set('RATE_LIMIT', { fix: 'Wait before retrying or reduce request frequency', confidence: 0.9 })
    this.errorPatterns.set('CONFIG_ERROR', { fix: 'Validate config.json syntax and required fields', confidence: 0.85 })
    this.errorPatterns.set('SECURITY_ERROR', { fix: 'Review security policy and allowed patterns', confidence: 0.7 })
  }

  private identifyRootCause(error: AgentError): string {
    // Analyze error message for common patterns first (more specific)
    const msg = error.message.toLowerCase()
    if (msg.includes('not found') || msg.includes('undefined')) return 'Missing resource or undefined reference'
    if (msg.includes('permission') || msg.includes('denied')) return 'Insufficient permissions'
    if (msg.includes('timeout') || msg.includes('timed out')) return 'Operation exceeded time limit'
    if (msg.includes('connection') || msg.includes('network')) return 'Network connectivity issue'
    if (msg.includes('parse') || msg.includes('syntax')) return 'Invalid data format or syntax error'
    if (msg.includes('type') || msg.includes('invalid')) return 'Type mismatch or invalid value'

    // Fall back to registered pattern
    const pattern = this.errorPatterns.get(error.code)
    if (pattern) return pattern.fix

    return 'Unknown root cause'
  }

  private generateSuggestions(error: AgentError, _rootCause: string): FixSuggestion[] {
    const suggestions: FixSuggestion[] = []

    // Use registered pattern if available
    const pattern = this.errorPatterns.get(error.code)
    if (pattern) {
      suggestions.push({
        description: pattern.fix,
        confidence: pattern.confidence
      })
    }

    // Add error-specific suggestions
    if (error.suggestion) {
      suggestions.push({
        description: error.suggestion,
        confidence: 0.85
      })
    }

    // Add context-based suggestions
    if (error.context) {
      if (error.context.model) {
        suggestions.push({
          description: `Verify model '${error.context.model}' is available on the current provider`,
          confidence: 0.9
        })
      }
      if (error.context.tool) {
        suggestions.push({
          description: `Check if tool '${error.context.tool}' is properly registered and has correct permissions`,
          confidence: 0.8
        })
      }
      if (error.context.provider) {
        suggestions.push({
          description: `Verify ${error.context.provider} provider is configured with valid credentials`,
          confidence: 0.85
        })
      }
    }

    // Add fallback suggestion
    if (suggestions.length === 0) {
      suggestions.push({
        description: `Review the error message and check logs for more details`,
        confidence: 0.5
      })
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }

  private findRelatedErrors(error: AgentError): string[] {
    const related: string[] = []

    if (error.category === 'provider') {
      related.push('Check network connectivity', 'Verify API credentials', 'Review rate limits')
    } else if (error.category === 'tool') {
      related.push('Check tool registration', 'Verify input schema', 'Review tool permissions')
    } else if (error.category === 'config') {
      related.push('Validate JSON syntax', 'Check required fields', 'Review file permissions')
    } else if (error.category === 'security') {
      related.push('Review security policy', 'Check allowed patterns', 'Verify input sanitization')
    }

    return related
  }

  formatAnalysis(analysis: ErrorAnalysis): string {
    const lines = [
      `Error: ${analysis.error.code} - ${analysis.error.message}`,
      `Severity: ${analysis.error.severity}`,
      `Root Cause: ${analysis.rootCause}`,
      `Auto-fixable: ${analysis.autoFixable ? 'Yes' : 'No'}`,
      ''
    ]

    if (analysis.suggestions.length > 0) {
      lines.push('Suggestions:')
      for (const s of analysis.suggestions) {
        lines.push(`  [${Math.round(s.confidence * 100)}%] ${s.description}`)
      }
    }

    if (analysis.relatedErrors.length > 0) {
      lines.push('')
      lines.push('Related checks:')
      for (const r of analysis.relatedErrors) {
        lines.push(`  - ${r}`)
      }
    }

    return lines.join('\n')
  }
}
