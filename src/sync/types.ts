// 云同步系统类型定义

export type SyncDirection = 'push' | 'pull' | 'bidirectional'

export type SyncStatus = 'idle' | 'syncing' | 'completed' | 'failed' | 'conflict'

export interface SyncConfig {
  remoteUrl: string
  syncInterval: number
  autoSync: boolean
  conflictStrategy: 'local_wins' | 'remote_wins' | 'manual'
  encrypted: boolean
}

export interface SyncEntry {
  key: string
  localVersion: number
  remoteVersion?: number
  localContent: string
  remoteContent?: string
  lastSyncedAt?: number
  status: 'synced' | 'modified' | 'conflict'
}

export interface SyncResult {
  status: SyncStatus
  pushed: number
  pulled: number
  conflicts: number
  duration: number
  errors: string[]
}

export interface SyncProvider {
  push(key: string, content: string, version: number): Promise<void>
  pull(key: string): Promise<{ content: string; version: number } | null>
  list(): Promise<string[]>
  delete(key: string): Promise<void>
}
