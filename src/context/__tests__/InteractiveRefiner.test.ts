import { describe, it, expect, beforeEach } from 'vitest'
import { InteractiveRefiner } from '../InteractiveRefiner.js'

describe('InteractiveRefiner', () => {
  let refiner: InteractiveRefiner

  beforeEach(() => {
    refiner = new InteractiveRefiner('Fix the bug', { maxAttempts: 3, strategies: ['approach-a', 'approach-b', 'approach-c'] })
  })

  describe('recordAttempt', () => {
    it('records successful attempt', () => {
      const attempt = refiner.recordAttempt('Try fix A', true, 'All tests pass')
      expect(attempt.result).toBe('success')
      expect(refiner.isComplete()).toBe(true)
    })

    it('records failed attempt', () => {
      refiner.recordAttempt('Try fix A', false, 'Tests still fail')
      expect(refiner.isComplete()).toBe(false)
    })

    it('increments attempt number', () => {
      refiner.recordAttempt('Try A', false, 'fail')
      refiner.recordAttempt('Try B', false, 'fail')
      const state = refiner.getState()
      expect(state.attempts[0].attempt).toBe(1)
      expect(state.attempts[1].attempt).toBe(2)
    })
  })

  describe('shouldRetry', () => {
    it('returns true when under limit and not complete', () => {
      refiner.recordAttempt('Try A', false, 'fail')
      expect(refiner.shouldRetry()).toBe(true)
    })

    it('returns false when at max attempts', () => {
      refiner.recordAttempt('A', false, 'fail')
      refiner.recordAttempt('B', false, 'fail')
      refiner.recordAttempt('C', false, 'fail')
      expect(refiner.shouldRetry()).toBe(false)
    })

    it('returns false when complete', () => {
      refiner.recordAttempt('A', true, 'success')
      expect(refiner.shouldRetry()).toBe(false)
    })
  })

  describe('getNextStrategy', () => {
    it('switches strategy after failure', () => {
      refiner.recordAttempt('Try A with approach-a', false, 'fail')
      const next = refiner.getNextStrategy()
      expect(next).toBe('approach-b')
    })

    it('skips failed strategies', () => {
      refiner.recordAttempt('A', false, 'fail')
      refiner.getNextStrategy()
      refiner.recordAttempt('B', false, 'fail')
      const next = refiner.getNextStrategy()
      expect(next).toBe('approach-c')
    })

    it('returns last strategy when all failed', () => {
      refiner.recordAttempt('A', false, 'fail')
      refiner.getNextStrategy()
      refiner.recordAttempt('B', false, 'fail')
      refiner.getNextStrategy()
      refiner.recordAttempt('C', false, 'fail')
      const next = refiner.getNextStrategy()
      expect(next).toBe('approach-c')
    })
  })

  describe('getFeedbackSummary', () => {
    it('returns summary with attempts', () => {
      refiner.recordAttempt('Try A', false, 'Type error on line 5')
      refiner.recordAttempt('Try B', false, 'Runtime error')
      const summary = refiner.getFeedbackSummary()
      expect(summary).toContain('Attempt 2/3')
      expect(summary).toContain('Runtime error')
      expect(summary).toContain('Type error')
    })

    it('returns no attempts message', () => {
      expect(refiner.getFeedbackSummary()).toContain('No attempts')
    })
  })

  describe('reset', () => {
    it('clears all attempts', () => {
      refiner.recordAttempt('A', false, 'fail')
      refiner.reset()
      expect(refiner.getState().attempts).toHaveLength(0)
    })
  })
})
