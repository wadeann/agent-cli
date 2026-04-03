// 4层记忆管理器 - User/Feedback/Project/Reference

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import type { MemoryEntry, MemoryLayer, MemoryVisibility, MemoryConfig, MemorySearchResult } from './types.js'
import { DEFAULT_MEMORY_CONFIG, MEMORY_LAYER_PRIORITY } from './types.js'

export class MemoryManager {
  private config: MemoryConfig
  private entries: Map<string, MemoryEntry> = new Map()
  private layerIndex: Map<MemoryLayer, Set<string>> = new Map([
    ['user', new Set()],
    ['feedback', new Set()],
    ['project', new Set()],
    ['reference', new Set()]
  ])

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config }
  }

  static create(configPath?: string): MemoryManager {
    const config: Partial<MemoryConfig> = {}
    if (configPath) {
      config.memoryDir = configPath
    }
    return new MemoryManager(config)
  }

  addEntry(
    layer: MemoryLayer,
    title: string,
    content: string,
    options: { visibility?: MemoryVisibility; tags?: string[] } = {}
  ): MemoryEntry {
    const maxEntries = this.config.maxEntriesPerLayer[layer]
    const layerIds = this.layerIndex.get(layer)!

    if (layerIds.size >= maxEntries) {
      this.evictOldest(layer)
    }

    const id = `mem-${layer}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()
    const entry: MemoryEntry = {
      id,
      layer,
      visibility: options.visibility ?? 'private',
      title,
      content,
      tags: options.tags ?? [],
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      accessCount: 0
    }

    this.entries.set(id, entry)
    layerIds.add(id)
    return entry
  }

  getEntry(id: string): MemoryEntry | null {
    const entry = this.entries.get(id)
    if (entry) {
      entry.lastAccessedAt = Date.now()
      entry.accessCount++
    }
    return entry ?? null
  }

  updateEntry(id: string, updates: Partial<Pick<MemoryEntry, 'title' | 'content' | 'tags'>>): boolean {
    const entry = this.entries.get(id)
    if (!entry) return false
    if (updates.title !== undefined) entry.title = updates.title
    if (updates.content !== undefined) entry.content = updates.content
    if (updates.tags !== undefined) entry.tags = updates.tags
    entry.updatedAt = Date.now()
    return true
  }

  deleteEntry(id: string): boolean {
    const entry = this.entries.get(id)
    if (!entry) return false
    this.entries.delete(id)
    this.layerIndex.get(entry.layer)?.delete(id)
    return true
  }

  getEntriesByLayer(layer: MemoryLayer): MemoryEntry[] {
    const ids = this.layerIndex.get(layer)!
    return Array.from(ids)
      .map(id => this.entries.get(id))
      .filter((e): e is MemoryEntry => e !== undefined)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getAllEntries(): MemoryEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => {
        const layerDiff = MEMORY_LAYER_PRIORITY[b.layer] - MEMORY_LAYER_PRIORITY[a.layer]
        if (layerDiff !== 0) return layerDiff
        return b.updatedAt - a.updatedAt
      })
  }

  search(query: string): MemorySearchResult[] {
    if (!this.config.search.enabled) return []

    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2)
    const results: MemorySearchResult[] = []

    for (const entry of this.entries.values()) {
      let score = 0

      for (const term of queryTerms) {
        const titleMatch = entry.title.toLowerCase().includes(term)
        const contentMatch = entry.content.toLowerCase().includes(term)
        const tagMatch = entry.tags.some(t => t.toLowerCase().includes(term))

        if (titleMatch) score += 3
        if (contentMatch) score += 1
        if (tagMatch) score += 2

        const regex = new RegExp(term, 'gi')
        const contentMatches = entry.content.match(regex)
        if (contentMatches) score += contentMatches.length * 0.5
      }

      if (score > 0) {
        const layerWeight = MEMORY_LAYER_PRIORITY[entry.layer]
        const recencyFactor = 1 + (Date.now() - entry.updatedAt) / (30 * 24 * 60 * 60 * 1000)
        const finalScore = (score * layerWeight) / recencyFactor

        if (finalScore >= this.config.search.minScore) {
          results.push({
            entry,
            score: finalScore,
            matchedLayer: entry.layer
          })
        }
      }
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, this.config.search.maxResults)
  }

  searchByLayer(query: string, layer: MemoryLayer): MemorySearchResult[] {
    const allResults = this.search(query)
    return allResults.filter(r => r.matchedLayer === layer)
  }

  getRelevantContext(query: string): string {
    const results = this.search(query)
    if (results.length === 0) return ''

    const sections: string[] = []
    const grouped = new Map<MemoryLayer, MemorySearchResult[]>()

    for (const result of results) {
      if (!grouped.has(result.matchedLayer)) {
        grouped.set(result.matchedLayer, [])
      }
      grouped.get(result.matchedLayer)!.push(result)
    }

    const layerLabels: Record<MemoryLayer, string> = {
      user: 'User Context',
      feedback: 'Feedback & Guidance',
      project: 'Project State',
      reference: 'Reference'
    }

    for (const [layer, layerResults] of grouped) {
      const label = layerLabels[layer]
      const items = layerResults.map(r => `- ${r.entry.title}: ${r.entry.content.slice(0, 200)}`).join('\n')
      sections.push(`## ${label}\n${items}`)
    }

    return sections.join('\n\n')
  }

  async saveToDisk(): Promise<void> {
    const dir = this.config.memoryDir
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    for (const layer of ['user', 'feedback', 'project', 'reference'] as MemoryLayer[]) {
      const entries = this.getEntriesByLayer(layer)
      if (entries.length === 0) continue

      const layerDir = join(dir, layer)
      if (!existsSync(layerDir)) mkdirSync(layerDir, { recursive: true })

      const content = entries.map(e => this.entryToMarkdown(e)).join('\n\n---\n\n')
      const filePath = join(layerDir, `${layer}.md`)
      writeFileSync(filePath, `# ${layer.charAt(0).toUpperCase() + layer.slice(1)} Memory\n\n${content}`)
    }
  }

  loadFromDisk(): number {
    const dir = this.config.memoryDir
    if (!existsSync(dir)) return 0

    let loaded = 0
    for (const layer of ['user', 'feedback', 'project', 'reference'] as MemoryLayer[]) {
      const layerDir = join(dir, layer)
      if (!existsSync(layerDir)) continue

      for (const file of readdirSync(layerDir)) {
        if (!file.endsWith('.md')) continue
        const filePath = join(layerDir, file)
        const content = readFileSync(filePath, 'utf-8')
        const entries = this.parseMarkdownFile(content, layer)
        for (const entry of entries) {
          this.entries.set(entry.id, entry)
          this.layerIndex.get(layer)!.add(entry.id)
          loaded++
        }
      }
    }
    return loaded
  }

  getStats(): Record<MemoryLayer, number> & { total: number } {
    const stats = { user: 0, feedback: 0, project: 0, reference: 0, total: 0 }
    for (const layer of this.layerIndex.keys()) {
      const count = this.layerIndex.get(layer)!.size
      stats[layer] = count
      stats.total += count
    }
    return stats
  }

  clear(): void {
    this.entries.clear()
    for (const ids of this.layerIndex.values()) ids.clear()
  }

  private evictOldest(layer: MemoryLayer): void {
    const ids = this.layerIndex.get(layer)!
    let oldestId: string | null = null
    let oldestTime = Infinity

    for (const id of ids) {
      const entry = this.entries.get(id)
      if (entry && entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt
        oldestId = id
      }
    }

    if (oldestId) {
      this.entries.delete(oldestId)
      ids.delete(oldestId)
    }
  }

  private entryToMarkdown(entry: MemoryEntry): string {
    const header = `---\nid: ${entry.id}\nvisibility: ${entry.visibility}\ntags: [${entry.tags.join(', ')}]\ncreated: ${new Date(entry.createdAt).toISOString()}\nupdated: ${new Date(entry.updatedAt).toISOString()}\naccessed: ${new Date(entry.lastAccessedAt).toISOString()}\naccessCount: ${entry.accessCount}\n---`
    return `\n## ${entry.title}\n\n${header}\n\n${entry.content}`
  }

  private parseMarkdownFile(content: string, layer: MemoryLayer): MemoryEntry[] {
    const entries: MemoryEntry[] = []
    const blocks = content.split(/\n## /)

    for (const block of blocks) {
      if (!block.includes('\nid: ')) continue

      const titleEnd = block.indexOf('\n')
      const title = titleEnd > 0 ? block.substring(0, titleEnd).trim() : null
      if (!title) continue

      const headerMatch = block.match(/id: (.+)\nvisibility: (.+)\ntags: \[(.*)\]\ncreated: (.+)\nupdated: (.+)\naccessed: (.+)\naccessCount: (\d+)/)
      if (!headerMatch) continue

      const bodyStart = block.indexOf('\n---\n\n')
      const bodyContent = bodyStart > 0 ? block.substring(bodyStart + 6).trim() : ''

      entries.push({
        id: headerMatch[1],
        layer,
        visibility: headerMatch[2] as MemoryVisibility,
        title,
        content: bodyContent,
        tags: headerMatch[3].split(',').map(t => t.trim()).filter(Boolean),
        createdAt: new Date(headerMatch[4]).getTime(),
        updatedAt: new Date(headerMatch[5]).getTime(),
        lastAccessedAt: new Date(headerMatch[6]).getTime(),
        accessCount: parseInt(headerMatch[7], 10)
      })
    }

    return entries
  }
}
