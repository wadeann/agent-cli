import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncManager } from '../SyncManager.js'
import type { SyncProvider } from '../types.js'

function createMockProvider(): SyncProvider {
  const store = new Map<string, { content: string; version: number }>()
  return {
    push: vi.fn().mockImplementation(async (key, content, version) => {
      store.set(key, { content, version })
    }),
    pull: vi.fn().mockImplementation(async (key) => {
      const entry = store.get(key)
      return entry ? { content: entry.content, version: entry.version } : null
    }),
    list: vi.fn().mockImplementation(async () => Array.from(store.keys())),
    delete: vi.fn().mockImplementation(async (key) => { store.delete(key) })
  }
}

describe('SyncManager', () => {
  let manager: SyncManager
  let provider: SyncProvider

  beforeEach(() => {
    manager = new SyncManager()
    provider = createMockProvider()
    manager.setProvider(provider)
  })

  describe('registerLocal', () => {
    it('registers local content', () => {
      manager.registerLocal('config', '{"key": "value"}')
      const entries = manager.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].key).toBe('config')
      expect(entries[0].status).toBe('modified')
    })

    it('increments version on re-register', () => {
      manager.registerLocal('config', 'v1')
      manager.registerLocal('config', 'v2')
      const entries = manager.getEntries()
      expect(entries[0].localVersion).toBe(2)
    })
  })

  describe('sync push', () => {
    it('pushes modified entries', async () => {
      manager.registerLocal('config', '{"key": "value"}')
      const result = await manager.sync('push')
      expect(result.status).toBe('completed')
      expect(result.pushed).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('marks pushed entries as synced', async () => {
      manager.registerLocal('config', 'data')
      await manager.sync('push')
      expect(manager.getEntries()[0].status).toBe('synced')
    })

    it('does not push already synced entries', async () => {
      manager.registerLocal('config', 'data')
      await manager.sync('push')
      const result = await manager.sync('push')
      expect(result.pushed).toBe(0)
    })
  })

  describe('sync pull', () => {
    it('pulls new remote entries', async () => {
      await provider.push('remote-config', 'remote data', 1)
      const result = await manager.sync('pull')
      expect(result.pulled).toBe(1)
      const entries = manager.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].localContent).toBe('remote data')
    })

    it('pulls newer remote versions', async () => {
      manager.registerLocal('config', 'local v1')
      await manager.sync('push')
      await provider.push('config', 'remote v2', 2)
      const result = await manager.sync('pull')
      expect(result.pulled).toBe(1)
      expect(manager.getEntries()[0].localContent).toBe('remote v2')
    })
  })

  describe('conflict resolution', () => {
    it('local_wins strategy', async () => {
      const conflictManager = new SyncManager({ conflictStrategy: 'local_wins' })
      conflictManager.setProvider(provider)
      conflictManager.registerLocal('config', 'local data')
      await conflictManager.sync('push')
      await provider.push('config', 'remote data', 2)
      conflictManager.registerLocal('config', 'local v2')
      const result = await conflictManager.sync('pull')
      expect(result.status).toBe('completed')
      expect(conflictManager.getEntries()[0].localContent).toBe('local v2')
    })

    it('remote_wins strategy', async () => {
      const conflictManager = new SyncManager({ conflictStrategy: 'remote_wins' })
      conflictManager.setProvider(provider)
      conflictManager.registerLocal('config', 'local data')
      await conflictManager.sync('push')
      await provider.push('config', 'remote data', 2)
      const result = await conflictManager.sync('pull')
      expect(result.pulled).toBe(1)
      expect(conflictManager.getEntries()[0].localContent).toBe('remote data')
    })

    it('manual strategy creates conflict', async () => {
      const conflictManager = new SyncManager({ conflictStrategy: 'manual' })
      conflictManager.setProvider(provider)
      conflictManager.registerLocal('config', 'local data')
      await conflictManager.sync('push')
      await provider.push('config', 'remote data', 2)
      conflictManager.registerLocal('config', 'local v2')
      const result = await conflictManager.sync('pull')
      expect(result.conflicts).toBe(1)
      expect(conflictManager.getEntries()[0].status).toBe('conflict')
    })

    it('resolveConflict with local wins', async () => {
      manager.registerLocal('config', 'local')
      const entry = manager.getEntries()[0]
      entry.status = 'conflict'
      entry.remoteContent = 'remote'
      expect(manager.resolveConflict('config', true)).toBe(true)
      expect(manager.getEntries()[0].status).toBe('modified')
    })

    it('resolveConflict with remote wins', async () => {
      manager.registerLocal('config', 'local')
      const entry = manager.getEntries()[0]
      entry.status = 'conflict'
      entry.remoteContent = 'remote'
      entry.remoteVersion = 2
      expect(manager.resolveConflict('config', false)).toBe(true)
      expect(manager.getEntries()[0].localContent).toBe('remote')
      expect(manager.getEntries()[0].status).toBe('synced')
    })
  })

  describe('error handling', () => {
    it('returns failed status without provider', async () => {
      const noProviderManager = new SyncManager()
      const result = await noProviderManager.sync()
      expect(result.status).toBe('failed')
      expect(result.errors).toHaveLength(1)
    })

    it('handles push errors gracefully', async () => {
      const errorProvider: SyncProvider = {
        push: vi.fn().mockRejectedValue(new Error('Network error')),
        pull: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn()
      }
      manager.setProvider(errorProvider)
      manager.registerLocal('config', 'data')
      const result = await manager.sync('push')
      expect(result.status).toBe('completed')
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('status tracking', () => {
    it('tracks pending sync count', () => {
      manager.registerLocal('a', 'data')
      manager.registerLocal('b', 'data')
      expect(manager.getPendingSyncCount()).toBe(2)
    })

    it('tracks conflict count', () => {
      manager.registerLocal('a', 'data')
      const entry = manager.getEntries()[0]
      entry.status = 'conflict'
      expect(manager.getConflictCount()).toBe(1)
    })

    it('clears all state', async () => {
      manager.registerLocal('a', 'data')
      manager.clear()
      expect(manager.getEntries()).toHaveLength(0)
      expect(manager.getStatus()).toBe('idle')
    })
  })
})
