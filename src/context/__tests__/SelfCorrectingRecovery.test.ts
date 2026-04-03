import { describe, it, expect, beforeEach } from 'vitest'
import { SelfCorrectingRecovery } from '../SelfCorrectingRecovery.js'
import { BaseAgentError, ProviderError, ToolError, NetworkError, ConfigError, SecurityError, ProviderAuthError, ModelNotFoundError, ToolTimeoutError, RateLimitError } from '../../errors/AgentErrors.js'

describe('SelfCorrectingRecovery', () => {
  let recovery: SelfCorrectingRecovery

  beforeEach(() => {
    recovery = new SelfCorrectingRecovery()
  })

  describe('analyzeError', () => {
    it('analyzes provider auth error', () => {
      const error = new ProviderAuthError('anthropic')
      const analysis = recovery.analyzeError(error)
      expect(analysis.rootCause).toBeDefined()
      expect(analysis.suggestions.length).toBeGreaterThan(0)
      expect(analysis.relatedErrors).toContain('Check network connectivity')
    })

    it('analyzes model not found error', () => {
      const error = new ModelNotFoundError('gpt-5')
      const analysis = recovery.analyzeError(error)
      expect(analysis.suggestions.some(s => s.description.includes('gpt-5'))).toBe(true)
    })

    it('analyzes tool timeout error', () => {
      const error = new ToolTimeoutError('Bash', 5000)
      const analysis = recovery.analyzeError(error)
      expect(analysis.suggestions.some(s => s.description.includes('timeout'))).toBe(true)
    })

    it('analyzes rate limit error', () => {
      const error = new RateLimitError('openai', 60)
      const analysis = recovery.analyzeError(error)
      expect(analysis.suggestions.some(s => s.description.includes('Retry') || s.description.includes('Wait'))).toBe(true)
    })

    it('identifies root cause from message', () => {
      const error = new ProviderError('Connection refused')
      const analysis = recovery.analyzeError(error)
      expect(analysis.rootCause.toLowerCase()).toContain('network')
    })

    it('identifies permission root cause', () => {
      const error = new ProviderError('Permission denied')
      const analysis = recovery.analyzeError(error)
      expect(analysis.rootCause.toLowerCase()).toContain('permission')
    })

    it('identifies timeout root cause', () => {
      const error = new ProviderError('Request timed out')
      const analysis = recovery.analyzeError(error)
      expect(analysis.rootCause.toLowerCase()).toContain('time')
    })

    it('identifies parse root cause', () => {
      const error = new ConfigError('Failed to parse JSON')
      const analysis = recovery.analyzeError(error)
      expect(analysis.rootCause.toLowerCase()).toContain('format')
    })

    it('provides context-based suggestions', () => {
      const error = new ToolError('Execution failed', { context: { tool: 'Bash' } })
      const analysis = recovery.analyzeError(error)
      expect(analysis.suggestions.some(s => s.description.includes('Bash'))).toBe(true)
    })

    it('finds related errors for provider category', () => {
      const error = new ProviderError('API error')
      const analysis = recovery.analyzeError(error)
      expect(analysis.relatedErrors).toContain('Check network connectivity')
      expect(analysis.relatedErrors).toContain('Verify API credentials')
    })

    it('finds related errors for tool category', () => {
      const error = new ToolError('Tool error')
      const analysis = recovery.analyzeError(error)
      expect(analysis.relatedErrors).toContain('Check tool registration')
    })

    it('finds related errors for config category', () => {
      const error = new ConfigError('Config error')
      const analysis = recovery.analyzeError(error)
      expect(analysis.relatedErrors).toContain('Validate JSON syntax')
    })

    it('finds related errors for security category', () => {
      const error = new SecurityError('Security violation')
      const analysis = recovery.analyzeError(error)
      expect(analysis.relatedErrors).toContain('Review security policy')
    })
  })

  describe('registerPattern', () => {
    it('registers custom patterns', () => {
      recovery.registerPattern('CUSTOM_ERR', 'Custom fix', 0.95)
      const error = new BaseAgentError('CUSTOM_ERR', 'Custom error')
      const analysis = recovery.analyzeError(error)
      expect(analysis.suggestions[0].description).toBe('Custom fix')
      expect(analysis.suggestions[0].confidence).toBe(0.95)
    })
  })

  describe('formatAnalysis', () => {
    it('formats analysis as readable string', () => {
      const error = new ProviderAuthError('anthropic')
      const analysis = recovery.analyzeError(error)
      const formatted = recovery.formatAnalysis(analysis)
      expect(formatted).toContain('Error:')
      expect(formatted).toContain('Root Cause:')
      expect(formatted).toContain('Suggestions:')
    })
  })
})
