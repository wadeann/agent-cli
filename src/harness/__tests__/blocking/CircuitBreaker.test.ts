import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CircuitBreaker } from '../../blocking/CircuitBreaker.js'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker({ maxSteps: 10, maxRetriesPerTask: 3, loopDetectionWindow: 6, loopThreshold: 3 })
  })

  describe('recordStep', () => {
    it('allows steps within limit', () => {
      for (let i = 0; i < 5; i++) {
        const result = breaker.recordStep(`action-${i}`)
        expect(result.shouldStop).toBe(false)
      }
    })

    it('stops at max steps', () => {
      for (let i = 0; i < 9; i++) breaker.recordStep(`step-${i}`)
      const result = breaker.recordStep('step-10')
      expect(result.shouldStop).toBe(true)
      expect(result.reason).toContain('Max steps')
    })

    it('tracks step count', () => {
      breaker.recordStep('a')
      breaker.recordStep('b')
      expect(breaker.getState().stepCount).toBe(2)
    })
  })

  describe('loop detection', () => {
    it('detects repeating action patterns', () => {
      // Pattern: A, B, C repeated 3 times
      breaker.recordStep('A')
      breaker.recordStep('B')
      breaker.recordStep('C')
      breaker.recordStep('A')
      breaker.recordStep('B')
      breaker.recordStep('C')
      breaker.recordStep('A')
      breaker.recordStep('B')
      const result = breaker.recordStep('C')
      expect(result.shouldStop).toBe(true)
      expect(breaker.getState().loopDetected).toBe(true)
    })

    it('does not flag diverse actions', () => {
      for (let i = 0; i < 20; i++) {
        breaker.recordStep(`unique-action-${i}`)
      }
      expect(breaker.getState().loopDetected).toBe(false)
    })
  })

  describe('retry tracking', () => {
    it('allows retries within limit', () => {
      const r1 = breaker.recordRetry('task-1')
      expect(r1.shouldStop).toBe(false)
      const r2 = breaker.recordRetry('task-1')
      expect(r2.shouldStop).toBe(false)
    })

    it('stops at max retries', () => {
      breaker.recordRetry('task-1')
      breaker.recordRetry('task-1')
      const result = breaker.recordRetry('task-1')
      expect(result.shouldStop).toBe(true)
      expect(result.reason).toContain('Max retries')
    })

    it('tracks retries per task independently', () => {
      breaker.recordRetry('task-1')
      breaker.recordRetry('task-2')
      const r1 = breaker.recordRetry('task-1')
      expect(r1.shouldStop).toBe(false)
    })
  })

  describe('suspend/resume', () => {
    it('suspends on loop detection', () => {
      for (let i = 0; i < 9; i++) breaker.recordStep('repeat')
      expect(breaker.getState().suspended).toBe(true)
    })

    it('blocks steps when suspended', () => {
      breaker.suspend('manual')
      const result = breaker.recordStep('test')
      expect(result.shouldStop).toBe(true)
    })

    it('resumes correctly', () => {
      breaker.suspend('test')
      breaker.resume()
      expect(breaker.getState().suspended).toBe(false)
      const result = breaker.recordStep('after-resume')
      expect(result.shouldStop).toBe(false)
    })

    it('calls suspend handler', async () => {
      let called = false
      breaker.setSuspendHandler(async () => { called = true })
      breaker.suspend('trigger')
      expect(called).toBe(true)
    })
  })

  describe('dead letter queue', () => {
    it('adds entries when max retries exceeded', () => {
      breaker.recordRetry('task-1')
      breaker.recordRetry('task-1')
      breaker.recordRetry('task-1')
      const dl = breaker.getDeadLetters()
      expect(dl).toHaveLength(1)
      expect(dl[0].taskId).toBe('task-1')
      expect(dl[0].retryCount).toBe(1)
    })

    it('increments retry count for existing entries', () => {
      breaker.recordRetry('task-1')
      breaker.recordRetry('task-1')
      breaker.recordRetry('task-1')
      breaker.recordRetry('task-1')
      const dl = breaker.getDeadLetters()
      expect(dl[0].retryCount).toBe(2)
    })
  })

  describe('reset', () => {
    it('clears all state', () => {
      breaker.recordStep('a')
      breaker.recordRetry('task-1')
      breaker.reset()
      expect(breaker.getState().stepCount).toBe(0)
      expect(breaker.getState().retryCount.size).toBe(0)
    })
  })

  describe('step history', () => {
    it('records all steps', () => {
      breaker.recordStep('read file', 'Read')
      breaker.recordStep('write file', 'Write')
      const history = breaker.getStepHistory()
      expect(history).toHaveLength(2)
      expect(history[0].toolUsed).toBe('Read')
      expect(history[1].toolUsed).toBe('Write')
    })
  })
})
