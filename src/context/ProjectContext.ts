// 持久化项目上下文 - 跨会话记忆

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export interface FileSnapshot {
  path: string
  size: number
  lastModified: number
  hash: string
}

export interface SessionRecord {
  id: string
  startedAt: number
  endedAt?: number
  filesChanged: string[]
  toolsUsed: string[]
  errors: string[]
  decisions: string[]
}

export interface ProjectPattern {
  description: string
  occurrences: number
  locations: string[]
  confidence: number
}

export interface ProjectContext {
  name: string
  rootPath: string
  fileIndex: Map<string, FileSnapshot>
  recentSessions: SessionRecord[]
  learnedPatterns: ProjectPattern[]
  userPreferences: Record<string, unknown>
  projectStructure: Record<string, string[]>
  lastUpdatedAt: number
}

export class ProjectContextManager {
  private context: ProjectContext
  private savePath: string

  constructor(projectPath: string, options: { name?: string; saveDir?: string } = {}) {
    this.savePath = join(options.saveDir ?? join(projectPath, '.agent-context'), 'context.json')
    this.context = {
      name: options.name ?? basename(projectPath),
      rootPath: projectPath,
      fileIndex: new Map(),
      recentSessions: [],
      learnedPatterns: [],
      userPreferences: {},
      projectStructure: {},
      lastUpdatedAt: Date.now()
    }
  }

  static async load(projectPath: string, options: { name?: string; saveDir?: string } = {}): Promise<ProjectContextManager> {
    const manager = new ProjectContextManager(projectPath, options)
    await manager.loadFromFile()
    return manager
  }

  async loadFromFile(): Promise<boolean> {
    if (!existsSync(this.savePath)) return false
    try {
      const raw = readFileSync(this.savePath, 'utf-8')
      const data = JSON.parse(raw)
      this.context = {
        ...data,
        fileIndex: new Map(data.fileIndex ?? []),
        projectStructure: data.projectStructure ?? {}
      }
      return true
    } catch {
      return false
    }
  }

  async saveToFile(): Promise<void> {
    const dir = join(this.savePath, '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const data = {
      ...this.context,
      fileIndex: Array.from(this.context.fileIndex.entries())
    }
    writeFileSync(this.savePath, JSON.stringify(data, null, 2))
  }

  scanProject(): void {
    const files = this.scanDirectory(this.context.rootPath)
    for (const file of files) {
      this.context.fileIndex.set(file.path, file)
    }
    this.context.lastUpdatedAt = Date.now()
  }

  detectChanges(): { added: string[]; modified: string[]; deleted: string[] } {
    const currentFiles = this.scanDirectory(this.context.rootPath)
    const added: string[] = []
    const modified: string[] = []
    const deleted: string[] = []

    for (const file of currentFiles) {
      const existing = this.context.fileIndex.get(file.path)
      if (!existing) {
        added.push(file.path)
      } else if (file.lastModified !== existing.lastModified || file.size !== existing.size) {
        modified.push(file.path)
      }
      this.context.fileIndex.set(file.path, file)
    }

    for (const [path] of this.context.fileIndex) {
      if (!currentFiles.some(f => f.path === path)) {
        deleted.push(path)
        this.context.fileIndex.delete(path)
      }
    }

    this.context.lastUpdatedAt = Date.now()
    return { added, modified, deleted }
  }

  recordSession(session: Omit<SessionRecord, 'id' | 'startedAt'>): SessionRecord {
    const record: SessionRecord = {
      ...session,
      id: `session-${Date.now()}`,
      startedAt: Date.now()
    }
    this.context.recentSessions.push(record)
    if (this.context.recentSessions.length > 50) {
      this.context.recentSessions = this.context.recentSessions.slice(-50)
    }
    return record
  }

  endSession(sessionId: string): void {
    const session = this.context.recentSessions.find(s => s.id === sessionId)
    if (session) {
      session.endedAt = Date.now()
    }
  }

  learnPattern(pattern: Omit<ProjectPattern, 'occurrences'>): void {
    const existing = this.context.learnedPatterns.find(p => p.description === pattern.description)
    if (existing) {
      existing.occurrences++
      existing.locations.push(...pattern.locations)
      existing.confidence = Math.min(1, existing.confidence + 0.1)
    } else {
      this.context.learnedPatterns.push({ ...pattern, occurrences: 1, confidence: 0.5 })
    }
  }

  setPreference(key: string, value: unknown): void {
    this.context.userPreferences[key] = value
  }

  getPreference<T>(key: string, defaultValue: T): T {
    return (this.context.userPreferences[key] as T) ?? defaultValue
  }

  getContext(): ProjectContext {
    return { ...this.context, fileIndex: new Map(this.context.fileIndex) }
  }

  getRecentSessions(count = 5): SessionRecord[] {
    return this.context.recentSessions.slice(-count)
  }

  getLearnedPatterns(): ProjectPattern[] {
    return [...this.context.learnedPatterns].sort((a, b) => b.confidence - a.confidence)
  }

  getProjectSummary(): string {
    const files = this.context.fileIndex.size
    const sessions = this.context.recentSessions.length
    const patterns = this.context.learnedPatterns.length
    return `Project: ${this.context.name}\nFiles: ${files}\nSessions: ${sessions}\nPatterns learned: ${patterns}`
  }

  reset(): void {
    this.context.fileIndex.clear()
    this.context.recentSessions = []
    this.context.learnedPatterns = []
    this.context.userPreferences = {}
    this.context.projectStructure = {}
  }

  private scanDirectory(dir: string): FileSnapshot[] {
    const files: FileSnapshot[] = []
    if (!existsSync(dir)) return files

    const scan = (currentDir: string) => {
      try {
        const entries = readdirSync(currentDir)
        for (const entry of entries) {
          if (entry === 'node_modules' || entry === '.git' || entry === '.agent-context') continue
          const fullPath = join(currentDir, entry)
          try {
            const stat = statSync(fullPath)
            if (stat.isDirectory()) {
              scan(fullPath)
            } else if (stat.isFile()) {
              files.push({
                path: fullPath,
                size: stat.size,
                lastModified: stat.mtimeMs,
                hash: `${fullPath}:${stat.size}:${stat.mtimeMs}`
              })
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    scan(dir)
    return files
  }
}

function basename(path: string): string {
  return path.split('/').pop() ?? path
}
