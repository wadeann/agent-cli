import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ProjectContextManager } from '../ProjectContext.js'
import { existsSync, rmSync, mkdirSync, writeFileSync, mkdtempSync } from 'fs'
import { join, tmpdir } from 'path'
import { tmpdir as osTmpdir } from 'os'

describe('ProjectContextManager', () => {
  let projectDir: string
  let saveDir: string

  beforeEach(() => {
    const suffix = Math.random().toString(36).slice(2, 10)
    projectDir = mkdtempSync(join(osTmpdir(), `project-${suffix}-`))
    saveDir = mkdtempSync(join(osTmpdir(), `context-${suffix}-`))
    writeFileSync(join(projectDir, 'index.ts'), 'console.log("hello")')
    mkdirSync(join(projectDir, 'src'), { recursive: true })
    writeFileSync(join(projectDir, 'src', 'main.ts'), 'export const main = () => {}')
  })

  afterEach(() => {
    if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true })
    if (existsSync(saveDir)) rmSync(saveDir, { recursive: true, force: true })
  })

  describe('scanProject', () => {
    it('indexes all files', () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      manager.scanProject()
      const ctx = manager.getContext()
      expect(ctx.fileIndex.size).toBeGreaterThanOrEqual(2)
    })
  })

  describe('detectChanges', () => {
    it('detects added files', () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      manager.scanProject()
      writeFileSync(join(projectDir, 'new.ts'), 'export const x = 1')
      const changes = manager.detectChanges()
      expect(changes.added).toContain(join(projectDir, 'new.ts'))
    })

    it('detects modified files', async () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      manager.scanProject()
      await new Promise(r => setTimeout(r, 10))
      writeFileSync(join(projectDir, 'index.ts'), 'console.log("changed")')
      const changes = manager.detectChanges()
      expect(changes.modified).toContain(join(projectDir, 'index.ts'))
    })

    it('detects deleted files', () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      manager.scanProject()
      rmSync(join(projectDir, 'index.ts'))
      const changes = manager.detectChanges()
      expect(changes.deleted).toContain(join(projectDir, 'index.ts'))
    })
  })

  describe('save/load', () => {
    it('saves and loads context', async () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      manager.scanProject()
      manager.setPreference('theme', 'dark')
      await manager.saveToFile()

      const manager2 = new ProjectContextManager(projectDir, { saveDir })
      const loaded = await manager2.loadFromFile()
      expect(loaded).toBe(true)
      expect(manager2.getPreference('theme', 'light')).toBe('dark')
    })

    it('returns false when no saved context', async () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      const loaded = await manager.loadFromFile()
      expect(loaded).toBe(false)
    })
  })

  describe('sessions', () => {
    it('records sessions', () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      const session = manager.recordSession({
        filesChanged: ['index.ts'],
        toolsUsed: ['Read', 'Write'],
        errors: [],
        decisions: ['Use TypeScript']
      })
      expect(session.id).toBeDefined()
      expect(session.filesChanged).toContain('index.ts')
    })

    it('limits recent sessions to 50', () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      for (let i = 0; i < 60; i++) {
        manager.recordSession({ filesChanged: [], toolsUsed: [], errors: [], decisions: [] })
      }
      expect(manager.getRecentSessions().length).toBeLessThanOrEqual(50)
    })

    it('ends sessions', () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      const session = manager.recordSession({ filesChanged: [], toolsUsed: [], errors: [], decisions: [] })
      manager.endSession(session.id)
      const sessions = manager.getRecentSessions()
      expect(sessions[0].endedAt).toBeDefined()
    })
  })

  describe('patterns', () => {
    it('learns patterns', () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      manager.learnPattern({ description: 'Uses React components', locations: ['src/App.tsx'], confidence: 0.8 })
      manager.learnPattern({ description: 'Uses React components', locations: ['src/Button.tsx'], confidence: 0.8 })
      const patterns = manager.getLearnedPatterns()
      expect(patterns).toHaveLength(1)
      expect(patterns[0].occurrences).toBe(2)
      expect(patterns[0].confidence).toBe(0.6)
    })
  })

  describe('preferences', () => {
    it('stores and retrieves preferences', () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      manager.setPreference('editor.tabSize', 2)
      expect(manager.getPreference('editor.tabSize', 4)).toBe(2)
      expect(manager.getPreference('missing', 'default')).toBe('default')
    })
  })

  describe('getProjectSummary', () => {
    it('returns formatted summary', () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      manager.scanProject()
      const summary = manager.getProjectSummary()
      expect(summary).toContain('Project:')
      expect(summary).toContain('Files:')
    })
  })

  describe('reset', () => {
    it('clears all data', () => {
      const manager = new ProjectContextManager(projectDir, { saveDir })
      manager.scanProject()
      manager.setPreference('key', 'value')
      manager.reset()
      expect(manager.getContext().fileIndex.size).toBe(0)
      expect(manager.getPreference('key', null)).toBeNull()
    })
  })
})
