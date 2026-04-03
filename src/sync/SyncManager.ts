// 云同步管理器 - 远程内存同步、配置备份、团队共享

import type { SyncConfig, SyncEntry, SyncResult, SyncProvider, SyncDirection } from './types.js'

export class SyncManager {
  private config: SyncConfig
  private provider: SyncProvider | null = null
  private entries: Map<string, SyncEntry> = new Map()
  private status: 'idle' | 'syncing' | 'completed' | 'failed' | 'conflict' = 'idle'

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = {
      remoteUrl: '',
      syncInterval: 300000,
      autoSync: false,
      conflictStrategy: 'local_wins',
      encrypted: false,
      ...config
    }
  }

  setProvider(provider: SyncProvider): void {
    this.provider = provider
  }

  registerLocal(key: string, content: string): void {
    const existing = this.entries.get(key)
    this.entries.set(key, {
      key,
      localVersion: existing ? existing.localVersion + 1 : 1,
      localContent: content,
      status: existing?.status === 'synced' ? 'modified' : (existing?.status ?? 'modified')
    })
  }

  async sync(direction: SyncDirection = 'bidirectional'): Promise<SyncResult> {
    if (!this.provider) {
      return { status: 'failed', pushed: 0, pulled: 0, conflicts: 0, duration: 0, errors: ['No sync provider configured'] }
    }

    this.status = 'syncing'
    const start = Date.now()
    const errors: string[] = []
    let pushed = 0
    let pulled = 0
    let conflicts = 0

    try {
      if (direction === 'push' || direction === 'bidirectional') {
        for (const [key, entry] of this.entries) {
          if (entry.status === 'synced') continue
          try {
            await this.provider.push(key, entry.localContent, entry.localVersion)
            entry.status = 'synced'
            entry.remoteVersion = entry.localVersion
            entry.lastSyncedAt = Date.now()
            pushed++
          } catch (err: unknown) {
            errors.push(`Failed to push ${key}: ${err instanceof Error ? err.message : 'Unknown'}`)
          }
        }
      }

      if (direction === 'pull' || direction === 'bidirectional') {
        const remoteKeys = await this.provider.list()
        for (const key of remoteKeys) {
          const remote = await this.provider.pull(key)
          if (!remote) continue

          const local = this.entries.get(key)
          if (!local) {
            this.entries.set(key, {
              key,
              localVersion: 1,
              remoteVersion: remote.version,
              localContent: remote.content,
              remoteContent: remote.content,
              lastSyncedAt: Date.now(),
              status: 'synced'
            })
            pulled++
          } else if (remote.version > (local.remoteVersion ?? 0)) {
            if (local.status === 'modified') {
              if (this.config.conflictStrategy === 'local_wins') {
                await this.provider.push(key, local.localContent, local.localVersion)
                local.remoteVersion = local.localVersion
                local.status = 'synced'
              } else if (this.config.conflictStrategy === 'remote_wins') {
                local.localContent = remote.content
                local.localVersion = remote.version
                local.remoteVersion = remote.version
                local.status = 'synced'
                pulled++
              } else {
                local.status = 'conflict'
                local.remoteContent = remote.content
                conflicts++
              }
            } else {
              local.localContent = remote.content
              local.localVersion = remote.version
              local.remoteVersion = remote.version
              local.status = 'synced'
              pulled++
            }
          }
        }
      }

      this.status = conflicts > 0 ? 'conflict' : 'completed'
      return { status: this.status, pushed, pulled, conflicts, duration: Date.now() - start, errors }
    } catch (err: unknown) {
      this.status = 'failed'
      errors.push(err instanceof Error ? err.message : 'Unknown sync error')
      return { status: 'failed', pushed, pulled, conflicts, duration: Date.now() - start, errors }
    }
  }

  resolveConflict(key: string, useLocal: boolean): boolean {
    const entry = this.entries.get(key)
    if (!entry || entry.status !== 'conflict') return false

    if (useLocal) {
      entry.status = 'modified'
      entry.remoteContent = undefined
    } else {
      entry.localContent = entry.remoteContent ?? entry.localContent
      entry.localVersion = entry.remoteVersion ?? entry.localVersion
      entry.status = 'synced'
      entry.remoteContent = undefined
    }
    return true
  }

  getPendingSyncCount(): number {
    return Array.from(this.entries.values()).filter(e => e.status !== 'synced').length
  }

  getConflictCount(): number {
    return Array.from(this.entries.values()).filter(e => e.status === 'conflict').length
  }

  getEntries(): SyncEntry[] {
    return Array.from(this.entries.values())
  }

  getStatus(): typeof this.status {
    return this.status
  }

  getConfig(): SyncConfig {
    return { ...this.config }
  }

  clear(): void {
    this.entries.clear()
    this.status = 'idle'
  }
}
