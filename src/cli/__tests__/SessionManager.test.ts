import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SessionManager } from '../SessionManager.js'
import { StreamRenderer } from '../StreamRenderer.js'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { join, tmpdir } from 'path'
import { tmpdir as osTmpdir } from 'os'

describe('SessionManager', () => {
  let sessionsDir: string
  let manager: SessionManager

  beforeEach(async () => {
    const suffix = Math.random().toString(36).slice(2, 10)
    sessionsDir = mkdtempSync(join(osTmpdir(), `sessions-${suffix}-`))
    manager = new SessionManager({ sessionsDir, maxSessions: 5, maxMessagesPerSession: 10 })
    await manager.initialize()
  })

  afterEach(() => {
    if (existsSync(sessionsDir)) rmSync(sessionsDir, { recursive: true, force: true })
  })

  describe('createSession', () => {
    it('creates a new session', () => {
      const session = manager.createSession('Test Session')
      expect(session.name).toBe('Test Session')
      expect(session.messageCount).toBe(0)
      expect(session.messages).toEqual([])
    })

    it('sets default name when not provided', () => {
      const session = manager.createSession()
      expect(session.name).toContain('Session')
    })

    it('sets as active session', () => {
      manager.createSession('Active')
      expect(manager.getActiveSession()?.name).toBe('Active')
    })
  })

  describe('switchSession', () => {
    it('switches to existing session', () => {
      const s1 = manager.createSession('First')
      manager.createSession('Second')
      const switched = manager.switchSession(s1.id)
      expect(switched?.name).toBe('First')
      expect(manager.getActiveSession()?.name).toBe('First')
    })

    it('returns null for non-existent session', () => {
      expect(manager.switchSession('nonexistent')).toBeNull()
    })
  })

  describe('addMessage', () => {
    it('adds message to active session', () => {
      manager.createSession('Test')
      manager.addMessage('user', 'Hello')
      manager.addMessage('assistant', 'Hi there')
      const history = manager.getSessionHistory()
      expect(history).toHaveLength(2)
      expect(history[0].role).toBe('user')
      expect(history[1].role).toBe('assistant')
    })

    it('creates session if none active', () => {
      manager.addMessage('user', 'Hello')
      expect(manager.getActiveSession()).not.toBeNull()
      expect(manager.getSessionHistory()).toHaveLength(1)
    })

    it('enforces max messages per session', () => {
      manager.createSession('Test')
      for (let i = 0; i < 15; i++) {
        manager.addMessage('user', `Message ${i}`)
      }
      expect(manager.getActiveSession()?.messageCount).toBe(15)
      expect(manager.getSessionHistory()).toHaveLength(10)
    })
  })

  describe('listSessions', () => {
    it('lists all sessions sorted by updatedAt', () => {
      manager.createSession('A')
      manager.createSession('B')
      const sessions = manager.listSessions()
      expect(sessions).toHaveLength(2)
    })

    it('enforces max sessions', () => {
      for (let i = 0; i < 10; i++) {
        manager.createSession(`Session ${i}`)
      }
      expect(manager.listSessions().length).toBeLessThanOrEqual(5)
    })
  })

  describe('deleteSession', () => {
    it('deletes a session', () => {
      const session = manager.createSession('To Delete')
      expect(manager.deleteSession(session.id)).toBe(true)
      expect(manager.switchSession(session.id)).toBeNull()
    })

    it('returns false for non-existent session', () => {
      expect(manager.deleteSession('nonexistent')).toBe(false)
    })

    it('clears active session if deleted', () => {
      const session = manager.createSession('Active')
      manager.deleteSession(session.id)
      expect(manager.getActiveSession()).toBeNull()
    })
  })

  describe('clearAllSessions', () => {
    it('clears all sessions', () => {
      manager.createSession('A')
      manager.createSession('B')
      manager.clearAllSessions()
      expect(manager.listSessions()).toHaveLength(0)
      expect(manager.getActiveSession()).toBeNull()
    })
  })
})

describe('StreamRenderer', () => {
  let renderer: StreamRenderer

  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    renderer = new StreamRenderer()
  })

  describe('start', () => {
    it('starts streaming mode', () => {
      renderer.start()
      expect(renderer.isStreamingActive()).toBe(true)
    })
  })

  describe('writeChunk', () => {
    it('accumulates chunks', () => {
      renderer.start()
      renderer.writeChunk('Hello ')
      renderer.writeChunk('World')
      expect(renderer.getBuffer()).toBe('Hello World')
    })

    it('does not write when not streaming', () => {
      renderer.writeChunk('Should not appear')
      expect(renderer.getBuffer()).toBe('')
    })
  })

  describe('stop', () => {
    it('stops streaming and returns stats', () => {
      renderer.start()
      renderer.writeChunk('Test ')
      renderer.writeChunk('Content')
      const stats = renderer.stop()
      expect(stats.content).toBe('Test Content')
      expect(stats.tokens).toBe(2)
      expect(stats.duration).toBeGreaterThanOrEqual(0)
      expect(renderer.isStreamingActive()).toBe(false)
    })
  })

  describe('clear', () => {
    it('clears buffer and stops streaming', () => {
      renderer.start()
      renderer.writeChunk('Buffer')
      renderer.clear()
      expect(renderer.getBuffer()).toBe('')
      expect(renderer.isStreamingActive()).toBe(false)
    })
  })
})
