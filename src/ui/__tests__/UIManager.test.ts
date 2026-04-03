import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UIManager } from '../UIManager.js'
import type { UIState } from '../types.js'

describe('UIManager', () => {
  let ui: UIManager

  beforeEach(() => {
    ui = new UIManager()
  })

  describe('getState', () => {
    it('returns initial state', () => {
      const state = ui.getState()
      expect(state.messages).toEqual([])
      expect(state.toolExecutions).toEqual([])
      expect(state.progress).toBeNull()
      expect(state.isStreaming).toBe(false)
    })
  })

  describe('subscribe', () => {
    it('notifies listeners on state changes', () => {
      const listener = vi.fn()
      ui.subscribe(listener)
      ui.addMessage('user', 'hello')
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener.mock.calls[0][0].messages).toHaveLength(1)
    })

    it('unsubscribes correctly', () => {
      const listener = vi.fn()
      const unsubscribe = ui.subscribe(listener)
      unsubscribe()
      ui.addMessage('user', 'hello')
      expect(listener).not.toHaveBeenCalled()
    })

    it('notifies multiple listeners', () => {
      const l1 = vi.fn()
      const l2 = vi.fn()
      ui.subscribe(l1)
      ui.subscribe(l2)
      ui.addMessage('user', 'hello')
      expect(l1).toHaveBeenCalledTimes(1)
      expect(l2).toHaveBeenCalledTimes(1)
    })
  })

  describe('addMessage', () => {
    it('adds a message with correct fields', () => {
      const msg = ui.addMessage('user', 'hello')
      expect(msg.type).toBe('user')
      expect(msg.content).toBe('hello')
      expect(msg.id).toBeDefined()
      expect(msg.timestamp).toBeDefined()
    })

    it('adds metadata when provided', () => {
      const msg = ui.addMessage('tool', 'executed', { toolName: 'read' })
      expect(msg.metadata).toEqual({ toolName: 'read' })
    })

    it('notifies listeners', () => {
      const listener = vi.fn()
      ui.subscribe(listener)
      ui.addMessage('user', 'test')
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('updateLastMessage', () => {
    it('updates the last message content', () => {
      ui.addMessage('assistant', 'partial')
      ui.updateLastMessage('complete response')
      const messages = ui.getMessages()
      expect(messages[messages.length - 1].content).toBe('complete response')
    })

    it('does nothing when no messages', () => {
      expect(() => ui.updateLastMessage('test')).not.toThrow()
    })

    it('notifies listeners', () => {
      const listener = vi.fn()
      ui.subscribe(listener)
      ui.addMessage('assistant', 'partial')
      ui.updateLastMessage('complete')
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearMessages', () => {
    it('removes all messages', () => {
      ui.addMessage('user', 'hello')
      ui.addMessage('assistant', 'hi')
      ui.clearMessages()
      expect(ui.getMessages()).toHaveLength(0)
    })
  })

  describe('tool executions', () => {
    it('adds a tool execution', () => {
      const exec = ui.addToolExecution('read', 'path: /test.txt')
      expect(exec.toolName).toBe('read')
      expect(exec.status).toBe('running')
      expect(exec.input).toBe('path: /test.txt')
      expect(exec.startedAt).toBeDefined()
    })

    it('updates tool execution status', () => {
      const exec = ui.addToolExecution('read', 'path: /test.txt')
      ui.updateToolExecution(exec.id, { status: 'success', output: 'file content' })
      const executions = ui.getToolExecutions()
      expect(executions[0].status).toBe('success')
      expect(executions[0].output).toBe('file content')
      expect(executions[0].completedAt).toBeDefined()
    })

    it('clears all tool executions', () => {
      ui.addToolExecution('read', 'path: /test.txt')
      ui.addToolExecution('write', 'path: /out.txt')
      ui.clearToolExecutions()
      expect(ui.getToolExecutions()).toHaveLength(0)
    })
  })

  describe('progress', () => {
    it('sets progress state', () => {
      ui.setProgress({ currentStep: 1, totalSteps: 5, message: 'Working...', percentage: 20 })
      const progress = ui.getProgress()
      expect(progress?.message).toBe('Working...')
      expect(progress?.percentage).toBe(20)
    })

    it('updates progress', () => {
      ui.setProgress({ currentStep: 1, totalSteps: 5, message: 'Start', percentage: 20 })
      ui.updateProgress('Step 2', 2)
      const progress = ui.getProgress()
      expect(progress?.message).toBe('Step 2')
      expect(progress?.currentStep).toBe(2)
      expect(progress?.percentage).toBe(40)
    })

    it('updates total steps and recalculates percentage', () => {
      ui.setProgress({ currentStep: 2, totalSteps: 4, message: 'Working', percentage: 50 })
      ui.updateProgress('Working', 2, 10)
      expect(ui.getProgress()?.percentage).toBe(20)
    })

    it('does nothing when no progress set', () => {
      expect(() => ui.updateProgress('test')).not.toThrow()
    })

    it('clears progress with null', () => {
      ui.setProgress({ currentStep: 1, totalSteps: 1, message: 'x', percentage: 100 })
      ui.setProgress(null)
      expect(ui.getProgress()).toBeNull()
    })
  })

  describe('streaming', () => {
    it('sets streaming state', () => {
      ui.setStreaming(true)
      expect(ui.isStreaming()).toBe(true)
      ui.setStreaming(false)
      expect(ui.isStreaming()).toBe(false)
    })
  })

  describe('cost summary', () => {
    it('sets cost summary', () => {
      ui.setCostSummary({ totalCost: 0.05, totalTokens: 1000, requests: 3 })
      const state = ui.getState()
      expect(state.costSummary).toEqual({ totalCost: 0.05, totalTokens: 1000, requests: 3 })
    })
  })

  describe('reset', () => {
    it('resets all state', () => {
      ui.addMessage('user', 'hello')
      ui.addToolExecution('read', 'path: /test.txt')
      ui.setProgress({ currentStep: 1, totalSteps: 5, message: 'x', percentage: 20 })
      ui.setStreaming(true)
      ui.setCostSummary({ totalCost: 0.01, totalTokens: 100, requests: 1 })
      ui.reset()
      const state = ui.getState()
      expect(state.messages).toEqual([])
      expect(state.toolExecutions).toEqual([])
      expect(state.progress).toBeNull()
      expect(state.isStreaming).toBe(false)
      expect(state.costSummary).toBeUndefined()
    })
  })
})
