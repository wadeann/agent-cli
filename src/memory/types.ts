// 4层记忆系统类型定义

export type MemoryLayer = 'user' | 'feedback' | 'project' | 'reference'

export type MemoryVisibility = 'private' | 'team'

export interface MemoryEntry {
  id: string
  layer: MemoryLayer
  visibility: MemoryVisibility
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
  lastAccessedAt: number
  accessCount: number
}

export interface MemoryFile {
  path: string
  entries: MemoryEntry[]
}

export interface MemorySearchResult {
  entry: MemoryEntry
  score: number
  matchedLayer: MemoryLayer
}

export interface MemoryConfig {
  memoryDir: string
  autoSave: boolean
  maxEntriesPerLayer: Record<MemoryLayer, number>
  search: {
    enabled: boolean
    maxResults: number
    minScore: number
  }
  compaction: {
    autoCompactThreshold: number
    microCompactIdleMinutes: number
    microCompactKeepRecent: number
  }
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  memoryDir: '.agent-memory',
  autoSave: true,
  maxEntriesPerLayer: {
    user: 50,
    feedback: 100,
    project: 200,
    reference: 50
  },
  search: {
    enabled: true,
    maxResults: 6,
    minScore: 0.35
  },
  compaction: {
    autoCompactThreshold: 0.8,
    microCompactIdleMinutes: 60,
    microCompactKeepRecent: 5
  }
}

export const MEMORY_LAYER_PRIORITY: Record<MemoryLayer, number> = {
  user: 4,
  feedback: 3,
  project: 2,
  reference: 1
}
