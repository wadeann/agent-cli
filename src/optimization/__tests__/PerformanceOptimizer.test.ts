import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LRUCache, MessageDeduplicator, Debouncer, BatchProcessor, PerformanceMetrics } from '../PerformanceOptimizer.js'
import type { ChatMessage } from '../../providers/base/types.js'

describe('LRUCache', () => {
  let cache: LRUCache<string, number>

  beforeEach(() => {
    cache = new LRUCache<string, number>(3)
  })

  it('stores and retrieves values', () => {
    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
  })

  it('returns undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined()
  })

  it('evicts least recently used when full', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    cache.set('d', 4)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
    expect(cache.get('d')).toBe(4)
  })

  it('updates access order on get', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    cache.get('a')
    cache.set('d', 4)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
  })

  it('updates value on set for existing key', () => {
    cache.set('a', 1)
    cache.set('a', 10)
    expect(cache.get('a')).toBe(10)
  })

  it('has works correctly', () => {
    cache.set('a', 1)
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
  })

  it('delete works correctly', () => {
    cache.set('a', 1)
    expect(cache.delete('a')).toBe(true)
    expect(cache.delete('b')).toBe(false)
    expect(cache.get('a')).toBeUndefined()
  })

  it('clear removes all entries', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('tracks hit rate', () => {
    cache.set('a', 1)
    cache.get('a')
    cache.get('a')
    cache.get('missing')
    expect(cache.hitRate).toBe(2 / 3)
  })
})

describe('MessageDeduplicator', () => {
  let dedup: MessageDeduplicator

  beforeEach(() => {
    dedup = new MessageDeduplicator()
  })

  it('detects duplicate messages', () => {
    const msg: ChatMessage = { role: 'tool', content: 'file content here' }
    expect(dedup.isDuplicate(msg)).toBe(false)
    expect(dedup.isDuplicate(msg)).toBe(true)
  })

  it('allows different messages', () => {
    const msg1: ChatMessage = { role: 'tool', content: 'content A' }
    const msg2: ChatMessage = { role: 'tool', content: 'content B' }
    expect(dedup.isDuplicate(msg1)).toBe(false)
    expect(dedup.isDuplicate(msg2)).toBe(false)
  })

  it('detects duplicates across roles', () => {
    const msg1: ChatMessage = { role: 'user', content: 'hello' }
    const msg2: ChatMessage = { role: 'assistant', content: 'hello' }
    expect(dedup.isDuplicate(msg1)).toBe(false)
    expect(dedup.isDuplicate(msg2)).toBe(false)
  })

  it('handles content blocks', () => {
    const msg1: ChatMessage = { role: 'user', content: [{ type: 'text', text: 'block content' }] }
    const msg2: ChatMessage = { role: 'user', content: [{ type: 'text', text: 'block content' }] }
    expect(dedup.isDuplicate(msg1)).toBe(false)
    expect(dedup.isDuplicate(msg2)).toBe(true)
  })

  it('respects max history limit', () => {
    const smallDedup = new MessageDeduplicator(2)
    const msg1: ChatMessage = { role: 'tool', content: 'a' }
    const msg2: ChatMessage = { role: 'tool', content: 'b' }
    const msg3: ChatMessage = { role: 'tool', content: 'c' }
    smallDedup.isDuplicate(msg1)
    smallDedup.isDuplicate(msg2)
    smallDedup.isDuplicate(msg3)
    expect(smallDedup.size).toBeLessThanOrEqual(2)
  })

  it('clear removes all history', () => {
    const msg: ChatMessage = { role: 'tool', content: 'content' }
    dedup.isDuplicate(msg)
    dedup.clear()
    expect(dedup.isDuplicate(msg)).toBe(false)
  })
})

describe('Debouncer', () => {
  let debouncer: Debouncer

  beforeEach(() => {
    vi.useFakeTimers()
    debouncer = new Debouncer()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays function execution', () => {
    const fn = vi.fn()
    debouncer.debounce('key', fn, 100)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancels previous timer on repeated calls', () => {
    const fn = vi.fn()
    debouncer.debounce('key', fn, 100)
    debouncer.debounce('key', fn, 100)
    debouncer.debounce('key', fn, 100)
    vi.advanceTimersByTime(150)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('handles different keys independently', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    debouncer.debounce('a', fn1, 50)
    debouncer.debounce('b', fn2, 100)
    vi.advanceTimersByTime(60)
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  it('cancel stops pending execution', () => {
    const fn = vi.fn()
    debouncer.debounce('key', fn, 100)
    debouncer.cancel('key')
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
  })

  it('clear cancels all pending', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    debouncer.debounce('a', fn1, 100)
    debouncer.debounce('b', fn2, 100)
    debouncer.clear()
    vi.advanceTimersByTime(200)
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).not.toHaveBeenCalled()
  })
})

describe('BatchProcessor', () => {
  let flushFn: ReturnType<typeof vi.fn>
  let processor: BatchProcessor<number>

  beforeEach(() => {
    vi.useFakeTimers()
    flushFn = vi.fn()
    processor = new BatchProcessor(flushFn, { maxBatchSize: 5, delayMs: 100 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('batches items and flushes after delay', async () => {
    processor.add(1)
    processor.add(2)
    processor.add(3)
    expect(flushFn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()
    expect(flushFn).toHaveBeenCalledWith([1, 2, 3])
  })

  it('flushes immediately when batch is full', async () => {
    for (let i = 1; i <= 5; i++) processor.add(i)
    await vi.runAllTimersAsync()
    expect(flushFn).toHaveBeenCalledWith([1, 2, 3, 4, 5])
  })

  it('tracks pending count', () => {
    processor.add(1)
    processor.add(2)
    expect(processor.pendingCount).toBe(2)
  })

  it('flush clears pending items', async () => {
    processor.add(1)
    processor.add(2)
    await processor.flush()
    expect(processor.pendingCount).toBe(0)
  })

  it('handles async flush function', async () => {
    const asyncFlush = vi.fn().mockResolvedValue(undefined)
    const asyncProcessor = new BatchProcessor<number>(asyncFlush, { maxBatchSize: 2, delayMs: 50 })
    asyncProcessor.add(1)
    asyncProcessor.add(2)
    await vi.runAllTimersAsync()
    expect(asyncFlush).toHaveBeenCalledWith([1, 2])
  })
})

describe('PerformanceMetrics', () => {
  let metrics: PerformanceMetrics

  beforeEach(() => {
    metrics = new PerformanceMetrics()
  })

  it('records timing', () => {
    const stop = metrics.startTimer('operation')
    stop()
    const timing = metrics.getTiming('operation')
    expect(timing).not.toBeNull()
    expect(timing!.count).toBe(1)
    expect(timing!.min).toBeGreaterThanOrEqual(0)
  })

  it('records multiple timings', () => {
    for (let i = 0; i < 10; i++) {
      const stop = metrics.startTimer('op')
      stop()
    }
    const timing = metrics.getTiming('op')
    expect(timing!.count).toBe(10)
  })

  it('calculates statistics', () => {
    const stop = metrics.startTimer('slow')
    stop()
    const timing = metrics.getTiming('slow')
    expect(timing!.min).toBeLessThanOrEqual(timing!.max)
    expect(timing!.avg).toBeGreaterThanOrEqual(timing!.min)
    expect(timing!.p95).toBeGreaterThanOrEqual(timing!.avg)
  })

  it('increments counters', () => {
    metrics.increment('requests')
    metrics.increment('requests')
    metrics.increment('requests', 5)
    expect(metrics.getCounter('requests')).toBe(7)
  })

  it('returns null for missing timing', () => {
    expect(metrics.getTiming('nonexistent')).toBeNull()
  })

  it('returns zero for missing counter', () => {
    expect(metrics.getCounter('nonexistent')).toBe(0)
  })

  it('getAllMetrics returns structured data', () => {
    metrics.increment('hits')
    const stop = metrics.startTimer('query')
    stop()
    const all = metrics.getAllMetrics()
    expect(all.counters).toEqual({ hits: 1 })
    expect(all.timings.query).toBeDefined()
    expect(all.timings.query.count).toBe(1)
  })

  it('reset clears all data', () => {
    metrics.increment('x')
    metrics.startTimer('y')()
    metrics.reset()
    expect(metrics.getAllMetrics().counters).toEqual({})
    expect(metrics.getAllMetrics().timings).toEqual({})
  })
})
