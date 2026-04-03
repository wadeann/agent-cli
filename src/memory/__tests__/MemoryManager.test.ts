import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryManager } from '../MemoryManager.js'
import type { MemoryLayer } from '../types.js'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('MemoryManager', () => {
  let manager: MemoryManager
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `agent-memory-test-${Date.now()}`)
    manager = MemoryManager.create(testDir)
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('addEntry', () => {
    it('adds an entry to the specified layer', () => {
      const entry = manager.addEntry('user', 'Goal', 'Build a web app')
      expect(entry.layer).toBe('user')
      expect(entry.title).toBe('Goal')
      expect(entry.content).toBe('Build a web app')
      expect(entry.id).toBeDefined()
    })

    it('sets default visibility to private', () => {
      const entry = manager.addEntry('project', 'Task', 'Do something')
      expect(entry.visibility).toBe('private')
    })

    it('sets custom visibility', () => {
      const entry = manager.addEntry('reference', 'API Doc', '...', { visibility: 'team' })
      expect(entry.visibility).toBe('team')
    })

    it('sets tags', () => {
      const entry = manager.addEntry('feedback', 'Style', 'Use TypeScript', { tags: ['coding', 'style'] })
      expect(entry.tags).toEqual(['coding', 'style'])
    })

    it('increments access count on retrieval', () => {
      const entry = manager.addEntry('user', 'Pref', 'Dark mode')
      const retrieved = manager.getEntry(entry.id)
      expect(retrieved?.accessCount).toBe(1)
      manager.getEntry(entry.id)
      expect(manager.getEntry(entry.id)?.accessCount).toBe(3)
    })
  })

  describe('getEntry', () => {
    it('returns null for non-existent entry', () => {
      expect(manager.getEntry('missing')).toBeNull()
    })

    it('updates lastAccessedAt on retrieval', () => {
      const entry = manager.addEntry('user', 'Test', 'Content')
      const before = entry.lastAccessedAt
      const retrieved = manager.getEntry(entry.id)
      expect(retrieved!.lastAccessedAt).toBeGreaterThanOrEqual(before)
    })
  })

  describe('updateEntry', () => {
    it('updates title', () => {
      const entry = manager.addEntry('user', 'Old', 'Content')
      manager.updateEntry(entry.id, { title: 'New' })
      expect(manager.getEntry(entry.id)?.title).toBe('New')
    })

    it('updates content', () => {
      const entry = manager.addEntry('user', 'Test', 'Old content')
      manager.updateEntry(entry.id, { content: 'New content' })
      expect(manager.getEntry(entry.id)?.content).toBe('New content')
    })

    it('updates tags', () => {
      const entry = manager.addEntry('user', 'Test', 'Content', { tags: ['a'] })
      manager.updateEntry(entry.id, { tags: ['b', 'c'] })
      expect(manager.getEntry(entry.id)?.tags).toEqual(['b', 'c'])
    })

    it('returns false for non-existent entry', () => {
      expect(manager.updateEntry('missing', { title: 'x' })).toBe(false)
    })

    it('updates updatedAt timestamp', async () => {
      const entry = manager.addEntry('user', 'Test', 'Content')
      const before = entry.updatedAt
      await new Promise(r => setTimeout(r, 2))
      manager.updateEntry(entry.id, { title: 'Updated' })
      expect(manager.getEntry(entry.id)!.updatedAt).toBeGreaterThan(before)
    })
  })

  describe('deleteEntry', () => {
    it('deletes an entry', () => {
      const entry = manager.addEntry('user', 'Test', 'Content')
      expect(manager.deleteEntry(entry.id)).toBe(true)
      expect(manager.getEntry(entry.id)).toBeNull()
    })

    it('removes from layer index', () => {
      const entry = manager.addEntry('project', 'Test', 'Content')
      manager.deleteEntry(entry.id)
      expect(manager.getEntriesByLayer('project')).toHaveLength(0)
    })

    it('returns false for non-existent entry', () => {
      expect(manager.deleteEntry('missing')).toBe(false)
    })
  })

  describe('getEntriesByLayer', () => {
    it('returns entries sorted by updatedAt', async () => {
      manager.addEntry('user', 'A', 'Content A')
      await new Promise(r => setTimeout(r, 2))
      manager.addEntry('user', 'B', 'Content B')
      const entries = manager.getEntriesByLayer('user')
      expect(entries).toHaveLength(2)
      expect(entries[0].title).toBe('B')
      expect(entries[1].title).toBe('A')
    })

    it('returns empty for layer with no entries', () => {
      expect(manager.getEntriesByLayer('feedback')).toEqual([])
    })
  })

  describe('getAllEntries', () => {
    it('returns all entries sorted by layer priority then updatedAt', () => {
      manager.addEntry('reference', 'Ref', 'Content')
      manager.addEntry('user', 'User', 'Content')
      manager.addEntry('project', 'Proj', 'Content')
      const entries = manager.getAllEntries()
      expect(entries[0].layer).toBe('user')
      expect(entries[1].layer).toBe('project')
      expect(entries[2].layer).toBe('reference')
    })
  })

  describe('search', () => {
    it('finds entries matching query', () => {
      manager.addEntry('user', 'TypeScript preference', 'Prefers TypeScript over JavaScript')
      manager.addEntry('project', 'Python script', 'Uses Python for data processing')
      const results = manager.search('TypeScript')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].entry.title).toContain('TypeScript')
    })

    it('scores title matches higher than content', () => {
      manager.addEntry('user', 'TypeScript', 'Some content')
      manager.addEntry('project', 'Other', 'Mentions TypeScript in content')
      const results = manager.search('TypeScript')
      expect(results[0].entry.title).toBe('TypeScript')
    })

    it('scores tag matches', () => {
      manager.addEntry('user', 'Pref', 'Content', { tags: ['typescript'] })
      const results = manager.search('typescript')
      expect(results.length).toBeGreaterThan(0)
    })

    it('respects maxResults limit', () => {
      for (let i = 0; i < 20; i++) {
        manager.addEntry('project', `Task ${i}`, `Description ${i}`)
      }
      const results = manager.search('Task')
      expect(results.length).toBeLessThanOrEqual(6)
    })

    it('returns empty for no matches', () => {
      manager.addEntry('user', 'Test', 'Content')
      expect(manager.search('nonexistent')).toEqual([])
    })

    it('applies layer priority weighting', () => {
      manager.addEntry('user', 'test', 'Content')
      manager.addEntry('reference', 'test', 'Content')
      const results = manager.search('test')
      expect(results[0].matchedLayer).toBe('user')
    })
  })

  describe('searchByLayer', () => {
    it('filters results by layer', () => {
      manager.addEntry('user', 'User test', 'Content')
      manager.addEntry('project', 'Project test', 'Content')
      const results = manager.searchByLayer('test', 'user')
      expect(results).toHaveLength(1)
      expect(results[0].matchedLayer).toBe('user')
    })
  })

  describe('getRelevantContext', () => {
    it('returns formatted context string', () => {
      manager.addEntry('user', 'Goal', 'Build app')
      manager.addEntry('feedback', 'Style', 'Use TypeScript')
      const context = manager.getRelevantContext('Goal Style')
      expect(context).toContain('User Context')
      expect(context).toContain('Feedback & Guidance')
      expect(context).toContain('Goal')
      expect(context).toContain('Style')
    })

    it('returns empty string for no results', () => {
      expect(manager.getRelevantContext('nonexistent')).toBe('')
    })
  })

  describe('saveToDisk / loadFromDisk', () => {
    it('saves and loads entries', () => {
      manager.addEntry('user', 'Goal', 'Build app')
      manager.addEntry('project', 'Task', 'Implement feature')
      manager.saveToDisk()

      const manager2 = MemoryManager.create(testDir)
      const loaded = manager2.loadFromDisk()
      expect(loaded).toBe(2)
      expect(manager2.getEntriesByLayer('user')).toHaveLength(1)
      expect(manager2.getEntriesByLayer('project')).toHaveLength(1)
    })

    it('returns 0 when directory does not exist', () => {
      expect(manager.loadFromDisk()).toBe(0)
    })
  })

  describe('eviction', () => {
    it('evicts oldest entry when layer is full', () => {
      const smallManager = new MemoryManager({
        memoryDir: testDir,
        maxEntriesPerLayer: { user: 2, feedback: 100, project: 100, reference: 100 },
        search: { enabled: false, maxResults: 6, minScore: 0.35 },
        compaction: { autoCompactThreshold: 0.8, microCompactIdleMinutes: 60, microCompactKeepRecent: 5 }
      })

      smallManager.addEntry('user', 'A', 'Content A')
      smallManager.addEntry('user', 'B', 'Content B')
      smallManager.addEntry('user', 'C', 'Content C')

      expect(smallManager.getEntriesByLayer('user')).toHaveLength(2)
    })
  })

  describe('getStats', () => {
    it('returns correct counts', () => {
      manager.addEntry('user', 'A', 'Content')
      manager.addEntry('user', 'B', 'Content')
      manager.addEntry('project', 'C', 'Content')
      const stats = manager.getStats()
      expect(stats.user).toBe(2)
      expect(stats.project).toBe(1)
      expect(stats.feedback).toBe(0)
      expect(stats.reference).toBe(0)
      expect(stats.total).toBe(3)
    })
  })

  describe('clear', () => {
    it('removes all entries', () => {
      manager.addEntry('user', 'A', 'Content')
      manager.addEntry('project', 'B', 'Content')
      manager.clear()
      expect(manager.getStats().total).toBe(0)
    })
  })
})
