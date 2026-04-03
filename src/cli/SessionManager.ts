// CLI会话管理器 - 多会话支持 + 会话历史

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface CLISession {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  messageCount: number
  provider: string
  model: string
  messages: Array<{
    role: string
    content: string
    timestamp: number
  }>
}

export interface SessionManagerConfig {
  sessionsDir?: string
  maxSessions?: number
  maxMessagesPerSession?: number
}

export class SessionManager {
  private sessionsDir: string
  private maxSessions: number
  private maxMessagesPerSession: number
  private activeSession: CLISession | null = null
  private sessions: Map<string, CLISession> = new Map()

  constructor(config: SessionManagerConfig = {}) {
    this.sessionsDir = config.sessionsDir ?? join(homedir(), '.agent-cli', 'sessions')
    this.maxSessions = config.maxSessions ?? 50
    this.maxMessagesPerSession = config.maxMessagesPerSession ?? 1000
  }

  async initialize(): Promise<void> {
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true })
    }
    await this.loadSessions()
  }

  private async loadSessions(): Promise<void> {
    if (!existsSync(this.sessionsDir)) return

    const files = readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const raw = readFileSync(join(this.sessionsDir, file), 'utf-8')
        const session = JSON.parse(raw) as CLISession
        this.sessions.set(session.id, session)
      } catch {
        // Skip corrupted session files
      }
    }
  }

  createSession(name?: string, provider = 'anthropic', model = 'claude-sonnet-4-5-20251120'): CLISession {
    const session: CLISession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name ?? `Session ${this.sessions.size + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      provider,
      model,
      messages: []
    }

    this.sessions.set(session.id, session)
    this.activeSession = session
    this.saveSession(session)
    this.enforceMaxSessions()
    return session
  }

  switchSession(sessionId: string): CLISession | null {
    const session = this.sessions.get(sessionId)
    if (session) {
      this.activeSession = session
      return session
    }
    return null
  }

  addMessage(role: string, content: string): void {
    if (!this.activeSession) {
      this.createSession()
    }

    const session = this.activeSession!
    session.messages.push({ role, content, timestamp: Date.now() })
    session.messageCount++
    session.updatedAt = Date.now()

    // Enforce max messages
    if (session.messages.length > this.maxMessagesPerSession) {
      session.messages = session.messages.slice(-this.maxMessagesPerSession)
    }

    this.saveSession(session)
  }

  getActiveSession(): CLISession | null {
    return this.activeSession
  }

  listSessions(): CLISession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    this.sessions.delete(sessionId)
    try {
      const filePath = join(this.sessionsDir, `${sessionId}.json`)
      if (existsSync(filePath)) {
        // Use sync unlink for simplicity
        const { unlinkSync } = require('fs')
        unlinkSync(filePath)
      }
    } catch {
      // Ignore deletion errors
    }

    if (this.activeSession?.id === sessionId) {
      this.activeSession = null
    }
    return true
  }

  clearAllSessions(): void {
    this.sessions.clear()
    this.activeSession = null
  }

  getSessionHistory(limit = 10): Array<{ role: string; content: string }> {
    if (!this.activeSession) return []
    return this.activeSession.messages.slice(-limit).map(m => ({ role: m.role, content: m.content }))
  }

  private saveSession(session: CLISession): void {
    try {
      const filePath = join(this.sessionsDir, `${session.id}.json`)
      writeFileSync(filePath, JSON.stringify(session, null, 2))
    } catch {
      // Ignore save errors
    }
  }

  private enforceMaxSessions(): void {
    if (this.sessions.size > this.maxSessions) {
      const sorted = Array.from(this.sessions.values())
        .sort((a, b) => a.updatedAt - b.updatedAt)
      const toRemove = sorted.slice(0, this.sessions.size - this.maxSessions)
      for (const session of toRemove) {
        this.deleteSession(session.id)
      }
    }
  }
}
