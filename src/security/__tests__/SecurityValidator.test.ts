import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityValidator } from '../SecurityValidator.js'

describe('SecurityValidator', () => {
  let validator: SecurityValidator

  beforeEach(() => {
    validator = new SecurityValidator()
  })

  describe('validateInput', () => {
    it('allows normal input', () => {
      const result = validator.validateInput('Hello world, this is a normal message')
      expect(result.valid).toBe(true)
    })

    it('rejects input exceeding max length', () => {
      const longInput = 'a'.repeat(200000)
      const result = validator.validateInput(longInput)
      expect(result.valid).toBe(false)
      expect(result.severity).toBe('critical')
    })

    it('rejects dangerous patterns', () => {
      const dangerous = 'rm -rf /'
      const result = validator.validateInput(dangerous)
      expect(result.valid).toBe(false)
      expect(result.severity).toBe('critical')
    })

    it('rejects eval patterns', () => {
      const result = validator.validateInput('eval(malicious_code)')
      expect(result.valid).toBe(false)
    })

    it('rejects subprocess patterns', () => {
      const result = validator.validateInput('subprocess.call("rm -rf /")')
      expect(result.valid).toBe(false)
    })
  })

  describe('validateCommand', () => {
    it('allows whitelisted commands', () => {
      const result = validator.validateCommand('ls', ['-la'])
      expect(result.valid).toBe(true)
    })

    it('rejects non-whitelisted commands', () => {
      const result = validator.validateCommand('malicious-cmd', [])
      expect(result.valid).toBe(false)
      expect(result.severity).toBe('critical')
    })

    it('rejects dangerous command arguments', () => {
      const result = validator.validateCommand('rm', ['-rf', '/'])
      expect(result.valid).toBe(false)
    })

    it('allows safe command arguments', () => {
      const result = validator.validateCommand('grep', ['-r', 'pattern', '.'])
      expect(result.valid).toBe(true)
    })
  })

  describe('validateToolAccess', () => {
    it('allows tools with permission', () => {
      expect(validator.validateToolAccess('Read').valid).toBe(true)
      expect(validator.validateToolAccess('Write').valid).toBe(true)
      expect(validator.validateToolAccess('Bash').valid).toBe(true)
    })

    it('rejects tools without permission', () => {
      const result = validator.validateToolAccess('UnknownTool')
      expect(result.valid).toBe(false)
      expect(result.severity).toBe('warning')
    })

    it('allows setting custom permissions', () => {
      validator.setPermission('CustomTool', { toolName: 'CustomTool', level: 'read' })
      expect(validator.validateToolAccess('CustomTool').valid).toBe(true)
    })

    it('allows revoking permissions', () => {
      validator.revokePermission('Read')
      expect(validator.validateToolAccess('Read').valid).toBe(false)
    })
  })

  describe('checkRateLimit', () => {
    it('allows requests within limits', () => {
      const result = validator.checkRateLimit(100, 0.01)
      expect(result.valid).toBe(true)
    })

    it('tracks request count', () => {
      for (let i = 0; i < 50; i++) {
        validator.checkRateLimit(100, 0.01)
      }
      const state = validator.getRateLimitState()
      expect(state.requestCount).toBe(50)
    })

    it('tracks token count', () => {
      validator.checkRateLimit(1000, 0.01)
      validator.checkRateLimit(2000, 0.01)
      const state = validator.getRateLimitState()
      expect(state.tokenCount).toBe(3000)
    })

    it('tracks cost', () => {
      validator.checkRateLimit(100, 0.5)
      validator.checkRateLimit(100, 0.3)
      const state = validator.getRateLimitState()
      expect(state.costAccumulated).toBeCloseTo(0.8, 2)
    })

    it('rejects when request limit exceeded', () => {
      const limitedValidator = new SecurityValidator({
        rateLimit: { requestsPerMinute: 3, tokensPerMinute: 1000000, costPerHour: 1000 }
      })
      limitedValidator.checkRateLimit(100, 0.01)
      limitedValidator.checkRateLimit(100, 0.01)
      limitedValidator.checkRateLimit(100, 0.01)
      const result = limitedValidator.checkRateLimit(100, 0.01)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Rate limit')
    })

    it('rejects when token limit exceeded', () => {
      const limitedValidator = new SecurityValidator({
        rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 200, costPerHour: 1000 }
      })
      limitedValidator.checkRateLimit(100, 0.01)
      limitedValidator.checkRateLimit(100, 0.01)
      limitedValidator.checkRateLimit(100, 0.01)
      const result = limitedValidator.checkRateLimit(100, 0.01)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Token limit')
    })

    it('rejects when cost limit exceeded', () => {
      const limitedValidator = new SecurityValidator({
        rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 1000000, costPerHour: 0.05 }
      })
      limitedValidator.checkRateLimit(100, 0.03)
      limitedValidator.checkRateLimit(100, 0.03)
      const result = limitedValidator.checkRateLimit(100, 0.03)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Cost limit')
    })

    it('resets rate limit', () => {
      validator.checkRateLimit(100, 0.01)
      validator.checkRateLimit(100, 0.01)
      validator.resetRateLimit()
      const state = validator.getRateLimitState()
      expect(state.requestCount).toBe(0)
      expect(state.tokenCount).toBe(0)
      expect(state.costAccumulated).toBe(0)
    })
  })

  describe('getPermissions', () => {
    it('returns all configured permissions', () => {
      const perms = validator.getPermissions()
      expect(perms.length).toBeGreaterThan(0)
      expect(perms.some(p => p.toolName === 'Read')).toBe(true)
    })
  })

  describe('getConfig', () => {
    it('returns current config', () => {
      const config = validator.getConfig()
      expect(config.maxInputLength).toBe(100000)
      expect(config.allowedCommands).toContain('ls')
    })
  })
})
