import { describe, it, expect, beforeEach } from 'vitest'
import { TerminalRenderer } from '../TerminalRenderer.js'
import type { UIMessage, ToolExecutionUI, ProgressState } from '../types.js'

describe('TerminalRenderer', () => {
  let renderer: TerminalRenderer

  beforeEach(() => {
    renderer = new TerminalRenderer(80, 24)
  })

  describe('renderMessage', () => {
    it('renders user message with prefix', () => {
      const msg: UIMessage = { id: '1', type: 'user', content: 'Hello', timestamp: Date.now() }
      const result = renderer.renderMessage(msg)
      expect(result).toContain('Hello')
    })

    it('renders assistant message', () => {
      const msg: UIMessage = { id: '2', type: 'assistant', content: 'Hi there', timestamp: Date.now() }
      const result = renderer.renderMessage(msg)
      expect(result).toContain('Hi there')
    })

    it('renders error message', () => {
      const msg: UIMessage = { id: '3', type: 'error', content: 'Something failed', timestamp: Date.now() }
      const result = renderer.renderMessage(msg)
      expect(result).toContain('Something failed')
    })

    it('renders tool message', () => {
      const msg: UIMessage = { id: '4', type: 'tool', content: 'Tool output', timestamp: Date.now() }
      const result = renderer.renderMessage(msg)
      expect(result).toContain('Tool output')
    })

    it('renders system message', () => {
      const msg: UIMessage = { id: '5', type: 'system', content: 'System init', timestamp: Date.now() }
      const result = renderer.renderMessage(msg)
      expect(result).toContain('System init')
    })

    it('renders thinking message', () => {
      const msg: UIMessage = { id: '6', type: 'thinking', content: 'Let me think...', timestamp: Date.now() }
      const result = renderer.renderMessage(msg)
      expect(result).toContain('Let me think...')
    })

    it('wraps long text', () => {
      const longContent = 'a'.repeat(200)
      const msg: UIMessage = { id: '7', type: 'user', content: longContent, timestamp: Date.now() }
      const result = renderer.renderMessage(msg)
      const lines = result.split('\n')
      expect(lines.length).toBeGreaterThan(1)
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(80)
      }
    })

    it('handles multi-line content', () => {
      const msg: UIMessage = { id: '8', type: 'user', content: 'line1\nline2', timestamp: Date.now() }
      const result = renderer.renderMessage(msg)
      expect(result).toContain('line1')
      expect(result).toContain('line2')
    })
  })

  describe('renderToolExecution', () => {
    it('renders running tool execution', () => {
      const exec: ToolExecutionUI = {
        id: '1', toolName: 'read', status: 'running', input: 'path: /test.txt', startedAt: Date.now()
      }
      const result = renderer.renderToolExecution(exec)
      expect(result).toContain('read')
    })

    it('renders completed tool execution with duration', () => {
      const started = Date.now()
      const completed = started + 150
      const exec: ToolExecutionUI = {
        id: '1', toolName: 'write', status: 'success', input: 'path: /out.txt',
        output: 'done', startedAt: started, completedAt: completed
      }
      const result = renderer.renderToolExecution(exec)
      expect(result).toContain('write')
      expect(result).toContain('150ms')
      expect(result).toContain('done')
    })

    it('renders error tool execution', () => {
      const exec: ToolExecutionUI = {
        id: '1', toolName: 'bash', status: 'error', input: 'rm -rf /',
        output: 'Permission denied', startedAt: Date.now(), completedAt: Date.now() + 10
      }
      const result = renderer.renderToolExecution(exec)
      expect(result).toContain('bash')
      expect(result).toContain('Permission denied')
    })
  })

  describe('renderProgress', () => {
    it('renders progress bar', () => {
      const progress: ProgressState = { currentStep: 2, totalSteps: 5, message: 'Processing', percentage: 40 }
      const result = renderer.renderProgress(progress)
      expect(result).toContain('Processing')
      expect(result).toContain('40%')
      expect(result).toContain('[')
      expect(result).toContain(']')
    })

    it('renders 0% progress', () => {
      const progress: ProgressState = { currentStep: 0, totalSteps: 10, message: 'Starting', percentage: 0 }
      const result = renderer.renderProgress(progress)
      expect(result).toContain('0%')
    })

    it('renders 100% progress', () => {
      const progress: ProgressState = { currentStep: 10, totalSteps: 10, message: 'Done', percentage: 100 }
      const result = renderer.renderProgress(progress)
      expect(result).toContain('100%')
    })
  })

  describe('renderCostSummary', () => {
    it('renders cost summary', () => {
      const summary = { totalCost: 0.0523, totalTokens: 15000, requests: 7 }
      const result = renderer.renderCostSummary(summary)
      expect(result).toContain('$0.0523')
      expect(result).toContain('15,000')
      expect(result).toContain('7')
    })

    it('formats zero cost', () => {
      const summary = { totalCost: 0, totalTokens: 0, requests: 0 }
      const result = renderer.renderCostSummary(summary)
      expect(result).toContain('$0.0000')
    })
  })

  describe('updateDimensions', () => {
    it('updates width and affects wrapping', () => {
      const longContent = 'a'.repeat(100)
      const msg: UIMessage = { id: '1', type: 'user', content: longContent, timestamp: Date.now() }

      renderer.updateDimensions(40, 24)
      const result40 = renderer.renderMessage(msg)
      const lines40 = result40.split('\n').length

      renderer.updateDimensions(80, 24)
      const result80 = renderer.renderMessage(msg)
      const lines80 = result80.split('\n').length

      expect(lines40).toBeGreaterThan(lines80)
    })
  })
})
