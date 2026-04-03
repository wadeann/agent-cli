import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TUIRenderer } from '../TUIRenderer.js'

describe('TUIRenderer', () => {
  let renderer: TUIRenderer
  let output: string

  beforeEach(() => {
    output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : ''
      return true
    })
    renderer = new TUIRenderer({ title: 'Test', showStatusBar: true })
  })

  describe('constructor', () => {
    it('creates renderer with defaults', () => {
      const r = new TUIRenderer()
      expect(r).toBeDefined()
    })

    it('uses custom options', () => {
      const r = new TUIRenderer({ title: 'Custom', prompt: '> ' })
      expect(r).toBeDefined()
    })
  })

  describe('addLine', () => {
    it('adds line to history', () => {
      renderer.addLine('Hello')
      renderer.addLine('World', { color: 'green', bold: true })
      expect(output).toContain('Hello')
      expect(output).toContain('World')
    })

    it('applies styling', () => {
      renderer.addLine('Error', { color: 'red', bold: true })
      expect(output).toContain('31')
      expect(output).toContain('1m')
    })

    it('applies prefix', () => {
      renderer.addLine('Response', { prefix: 'AI: ' })
      expect(output).toContain('AI: ')
    })
  })

  describe('addSeparator', () => {
    it('adds a separator line', () => {
      renderer.addSeparator()
      expect(output).toContain('─')
    })
  })

  describe('setStatus', () => {
    it('updates status text', () => {
      renderer.setStatus('Thinking...')
      expect(output).toContain('Thinking...')
    })
  })

  describe('setCost', () => {
    it('updates cost text', () => {
      const r = new TUIRenderer({ showCost: true })
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        output += typeof chunk === 'string' ? chunk : ''
        return true
      })
      r.setCost('$0.0012')
      expect(output).toContain('$0.0012')
    })
  })

  describe('setInput', () => {
    it('updates input buffer', () => {
      renderer.setInput('hello world')
      expect(output).toContain('hello world')
    })
  })

  describe('render', () => {
    it('renders full screen', () => {
      renderer.render()
      expect(output).toContain('Test')
    })

    it('renders with history', () => {
      renderer.addLine('Line 1')
      renderer.addLine('Line 2')
      renderer.render()
      expect(output).toContain('Line 1')
      expect(output).toContain('Line 2')
    })
  })

  describe('resize', () => {
    it('updates dimensions', () => {
      renderer.resize()
      expect(output.length).toBeGreaterThan(0)
    })
  })
})
