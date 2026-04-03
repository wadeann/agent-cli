import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BaseAgentError,
  ProviderError,
  ModelNotFoundError,
  ProviderAuthError,
  ToolError,
  ToolPermissionError,
  ToolTimeoutError,
  NetworkError,
  RateLimitError,
  ConfigError,
  SecurityError,
  ErrorReporter
} from '../AgentErrors.js'

describe('Agent Errors', () => {
  describe('BaseAgentError', () => {
    it('creates error with all fields', () => {
      const error = new BaseAgentError('TEST', 'Test error', {
        severity: 'warning',
        category: 'system',
        context: { key: 'value' },
        recoverable: true,
        suggestion: 'Try again'
      })
      expect(error.code).toBe('TEST')
      expect(error.message).toBe('Test error')
      expect(error.severity).toBe('warning')
      expect(error.category).toBe('system')
      expect(error.context).toEqual({ key: 'value' })
      expect(error.recoverable).toBe(true)
      expect(error.suggestion).toBe('Try again')
      expect(error.timestamp).toBeGreaterThan(0)
    })

    it('serializes to JSON', () => {
      const error = new BaseAgentError('TEST', 'Test')
      const json = error.toJSON()
      expect(json.code).toBe('TEST')
      expect(json.message).toBe('Test')
      expect(json.stack).toBeDefined()
    })
  })

  describe('ProviderError', () => {
    it('sets category to provider', () => {
      const error = new ProviderError('API failed')
      expect(error.category).toBe('provider')
    })
  })

  describe('ModelNotFoundError', () => {
    it('creates with model context', () => {
      const error = new ModelNotFoundError('gpt-5')
      expect(error.code).toBe('PROVIDER_ERROR')
      expect(error.context?.model).toBe('gpt-5')
      expect(error.suggestion).toContain('agent models')
    })
  })

  describe('ProviderAuthError', () => {
    it('creates with fatal severity', () => {
      const error = new ProviderAuthError('anthropic')
      expect(error.severity).toBe('fatal')
      expect(error.recoverable).toBe(false)
      expect(error.context?.provider).toBe('anthropic')
    })
  })

  describe('ToolError', () => {
    it('sets category to tool', () => {
      const error = new ToolError('Execution failed')
      expect(error.category).toBe('tool')
    })
  })

  describe('ToolPermissionError', () => {
    it('creates with tool context', () => {
      const error = new ToolPermissionError('Bash')
      expect(error.code).toBe('TOOL_ERROR')
      expect(error.context?.tool).toBe('Bash')
      expect(error.recoverable).toBe(false)
    })
  })

  describe('ToolTimeoutError', () => {
    it('creates with timeout info', () => {
      const error = new ToolTimeoutError('Bash', 5000)
      expect(error.message).toContain('5000ms')
      expect(error.recoverable).toBe(true)
    })
  })

  describe('NetworkError', () => {
    it('sets category to network', () => {
      const error = new NetworkError('Connection refused')
      expect(error.category).toBe('network')
    })
  })

  describe('RateLimitError', () => {
    it('creates with retry info', () => {
      const error = new RateLimitError('openai', 60)
      expect(error.suggestion).toContain('60s')
    })

    it('creates without retry info', () => {
      const error = new RateLimitError('openai')
      expect(error.suggestion).toContain('Wait')
    })
  })

  describe('ConfigError', () => {
    it('sets category to config', () => {
      const error = new ConfigError('Invalid config')
      expect(error.category).toBe('config')
    })
  })

  describe('SecurityError', () => {
    it('sets non-recoverable by default', () => {
      const error = new SecurityError('Unauthorized')
      expect(error.recoverable).toBe(false)
      expect(error.category).toBe('security')
    })
  })
})

describe('ErrorReporter', () => {
  let reporter: ErrorReporter

  beforeEach(() => {
    reporter = new ErrorReporter(5)
  })

  it('records errors', () => {
    reporter.report(new ProviderError('API error'))
    expect(reporter.getErrorCount()).toBe(1)
  })

  it('filters by severity', () => {
    reporter.report(new ProviderError('error1', { severity: 'error' }))
    reporter.report(new ProviderError('warn1', { severity: 'warning' }))
    reporter.report(new ProviderError('fatal1', { severity: 'fatal' }))
    expect(reporter.getErrorCount('error')).toBe(1)
    expect(reporter.getErrorCount('warning')).toBe(1)
    expect(reporter.getErrorCount('fatal')).toBe(1)
  })

  it('returns recent errors', () => {
    for (let i = 0; i < 10; i++) {
      reporter.report(new ProviderError(`error-${i}`))
    }
    const recent = reporter.getRecentErrors(3)
    expect(recent).toHaveLength(3)
    expect(recent[0].message).toBe('error-7')
    expect(recent[2].message).toBe('error-9')
  })

  it('respects max history', () => {
    for (let i = 0; i < 10; i++) {
      reporter.report(new ProviderError(`error-${i}`))
    }
    expect(reporter.getErrorCount()).toBe(5)
  })

  it('calls onFatal handler', () => {
    const handler = vi.fn()
    reporter.setOnFatal(handler)
    reporter.report(new ProviderAuthError('anthropic'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('generates report', () => {
    reporter.report(new ProviderError('error1', { severity: 'error' }))
    reporter.report(new ProviderError('warn1', { severity: 'warning' }))
    const report = reporter.generateReport()
    expect(report).toContain('Error Report')
    expect(report).toContain('Error: 1')
    expect(report).toContain('Warning: 1')
  })

  it('clears all errors', () => {
    reporter.report(new ProviderError('error1'))
    reporter.report(new ProviderError('error2'))
    reporter.clear()
    expect(reporter.getErrorCount()).toBe(0)
  })
})
