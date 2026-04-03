// 性能优化 - 缓存、去重、批处理

import type { ChatMessage } from '../providers/base/types.js'

// LRU缓存
export class LRUCache<K, V> {
  private cache: Map<K, V> = new Map()
  private maxSize: number
  private _hits = 0
  private _misses = 0

  constructor(maxSize = 1000) {
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      this._hits++
      this.cache.delete(key)
      this.cache.set(key, value)
    } else {
      this._misses++
    }
    return value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }

  get hitRate(): number {
    return this._hits / (this._hits + this._misses) || 0
  }
}

// 消息去重器 - 检测重复的工具结果
export class MessageDeduplicator {
  private seenHashes: Set<string> = new Set()
  private maxHistory: number

  constructor(maxHistory = 500) {
    this.maxHistory = maxHistory
  }

  isDuplicate(message: ChatMessage): boolean {
    const hash = this.hashMessage(message)
    if (this.seenHashes.has(hash)) return true
    this.seenHashes.add(hash)
    if (this.seenHashes.size > this.maxHistory) {
      const first = this.seenHashes.values().next().value
      if (first) this.seenHashes.delete(first)
    }
    return false
  }

  private hashMessage(message: ChatMessage): string {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    return `${message.role}:${content.substring(0, 200)}`
  }

  clear(): void {
    this.seenHashes.clear()
  }

  get size(): number {
    return this.seenHashes.size
  }
}

// 防抖处理器 - 防止快速连续触发
export class Debouncer {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  debounce(key: string, fn: () => void, delayMs: number): void {
    const existing = this.timers.get(key)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      this.timers.delete(key)
      fn()
    }, delayMs)
    this.timers.set(key, timer)
  }

  cancel(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
  }

  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }
}

// 批处理器 - 批量执行操作
export class BatchProcessor<T> {
  private items: T[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private flushFn: (items: T[]) => void | Promise<void>
  private maxBatchSize: number
  private delayMs: number

  constructor(flushFn: (items: T[]) => void | Promise<void>, options: { maxBatchSize?: number; delayMs?: number } = {}) {
    this.flushFn = flushFn
    this.maxBatchSize = options.maxBatchSize ?? 50
    this.delayMs = options.delayMs ?? 100
  }

  add(item: T): void {
    this.items.push(item)
    if (this.items.length >= this.maxBatchSize) {
      this.flush()
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.delayMs)
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.items.length === 0) return
    const batch = [...this.items]
    this.items = []
    await this.flushFn(batch)
  }

  get pendingCount(): number {
    return this.items.length
  }
}

// 性能指标收集器
export class PerformanceMetrics {
  private timings: Map<string, number[]> = new Map()
  private counters: Map<string, number> = new Map()

  startTimer(key: string): () => number {
    const start = performance.now()
    return () => {
      const elapsed = performance.now() - start
      if (!this.timings.has(key)) this.timings.set(key, [])
      this.timings.get(key)!.push(elapsed)
      return elapsed
    }
  }

  increment(key: string, amount = 1): void {
    this.counters.set(key, (this.counters.get(key) ?? 0) + amount)
  }

  getTiming(key: string): { count: number; min: number; max: number; avg: number; p95: number } | null {
    const values = this.timings.get(key)
    if (!values || values.length === 0) return null
    const sorted = [...values].sort((a, b) => a - b)
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p95: sorted[Math.floor(sorted.length * 0.95)]
    }
  }

  getCounter(key: string): number {
    return this.counters.get(key) ?? 0
  }

  getAllMetrics(): {
    timings: Record<string, { count: number; min: number; max: number; avg: number; p95: number }>
    counters: Record<string, number>
  } {
    const timings: Record<string, { count: number; min: number; max: number; avg: number; p95: number }> = {}
    for (const [key] of this.timings) {
      const t = this.getTiming(key)
      if (t) timings[key] = t
    }
    const counters: Record<string, number> = {}
    for (const [key, value] of this.counters) counters[key] = value
    return { timings, counters }
  }

  reset(): void {
    this.timings.clear()
    this.counters.clear()
  }
}
