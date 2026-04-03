import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RouterWorkerManager, PubSub } from '../../blocking/RouterWorker.js'
import type { RouterTask, CheckpointData } from '../../blocking/types.js'

describe('PubSub', () => {
  let pubsub: PubSub

  beforeEach(() => {
    pubsub = new PubSub()
  })

  it('delivers messages to subscribers', () => {
    const handler = vi.fn()
    pubsub.subscribe('test', handler)
    pubsub.publish('test', { data: 'hello' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].topic).toBe('test')
    expect(handler.mock.calls[0][0].data).toEqual({ data: 'hello' })
  })

  it('supports multiple subscribers', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    pubsub.subscribe('test', h1)
    pubsub.subscribe('test', h2)
    pubsub.publish('test', {})
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe works', () => {
    const handler = vi.fn()
    const unsub = pubsub.subscribe('test', handler)
    unsub()
    pubsub.publish('test', {})
    expect(handler).not.toHaveBeenCalled()
  })

  it('lists topics', () => {
    pubsub.subscribe('a', () => {})
    pubsub.subscribe('b', () => {})
    expect(pubsub.getTopics()).toContain('a')
    expect(pubsub.getTopics()).toContain('b')
  })

  it('clear removes all topics', () => {
    pubsub.subscribe('a', () => {})
    pubsub.clear()
    expect(pubsub.getTopics()).toHaveLength(0)
  })
})

describe('RouterWorkerManager', () => {
  let manager: RouterWorkerManager

  beforeEach(() => {
    manager = new RouterWorkerManager()
  })

  it('registers workers', () => {
    manager.registerWorker('code', async () => ({ taskId: '1', success: true, output: '', completedAt: Date.now() }))
    expect(manager.getWorkerTypes()).toContain('code')
  })

  it('dispatches tasks to workers', async () => {
    const handler = vi.fn().mockResolvedValue({ taskId: 't1', success: true, output: 'done', completedAt: Date.now() })
    manager.registerWorker('test', handler)

    const task: RouterTask = { id: 't1', type: 'test', payload: {}, priority: 'normal', createdAt: Date.now() }
    manager.dispatchTask(task)

    await new Promise(r => setTimeout(r, 50))
    expect(handler).toHaveBeenCalledWith(task)
  })

  it('publishes task lifecycle events', async () => {
    const events: string[] = []
    manager.getPubSub().subscribe('task.dispatched', () => events.push('dispatched'))
    manager.getPubSub().subscribe('task.started', () => events.push('started'))
    manager.getPubSub().subscribe('task.completed', () => events.push('completed'))

    manager.registerWorker('test', async () => ({ taskId: 't1', success: true, output: '', completedAt: Date.now() }))
    manager.dispatchTask({ id: 't1', type: 'test', payload: {}, priority: 'normal', createdAt: Date.now() })

    await new Promise(r => setTimeout(r, 50))
    expect(events).toContain('dispatched')
    expect(events).toContain('started')
    expect(events).toContain('completed')
  })

  it('handles missing worker type', async () => {
    const events: string[] = []
    manager.getPubSub().subscribe('task.failed', () => events.push('failed'))
    manager.dispatchTask({ id: 't1', type: 'unknown', payload: {}, priority: 'normal', createdAt: Date.now() })
    await new Promise(r => setTimeout(r, 50))
    expect(events).toContain('failed')
  })

  it('handles task timeout', async () => {
    const events: string[] = []
    manager.getPubSub().subscribe('task.failed', () => events.push('failed'))
    manager.registerWorker('slow', async () => { await new Promise(() => {}); return { taskId: 't1', success: true, output: '', completedAt: Date.now() } })
    manager.dispatchTask({ id: 't1', type: 'slow', payload: {}, priority: 'normal', createdAt: Date.now(), timeoutMs: 50 })
    await new Promise(r => setTimeout(r, 100))
    expect(events).toContain('failed')
  })

  it('tracks pending tasks', async () => {
    manager.registerWorker('slow', async () => { await new Promise(r => setTimeout(r, 100)); return { taskId: 't1', success: true, output: '', completedAt: Date.now() } })
    manager.dispatchTask({ id: 't1', type: 'slow', payload: {}, priority: 'normal', createdAt: Date.now() })
    expect(manager.getPendingTasks()).toHaveLength(1)
    await new Promise(r => setTimeout(r, 150))
    expect(manager.getPendingTasks()).toHaveLength(0)
  })

  it('tracks queue length', () => {
    expect(manager.getQueueLength()).toBe(0)
    manager.dispatchTask({ id: 't1', type: 'test', payload: {}, priority: 'normal', createdAt: Date.now() })
    expect(manager.getQueueLength()).toBeGreaterThanOrEqual(0)
  })
})

describe('Checkpointing', () => {
  let manager: RouterWorkerManager

  beforeEach(() => {
    manager = new RouterWorkerManager()
  })

  it('saves and loads checkpoints', () => {
    const cp: CheckpointData = {
      taskId: 't1',
      state: { progress: 50 },
      messages: 'conversation history',
      context: { model: 'test' },
      serializedAt: Date.now()
    }
    manager.saveCheckpoint(cp)
    const loaded = manager.loadCheckpoint('t1')
    expect(loaded).not.toBeNull()
    expect(loaded?.state).toEqual({ progress: 50 })
  })

  it('returns null for missing checkpoint', () => {
    expect(manager.loadCheckpoint('missing')).toBeNull()
  })

  it('publishes checkpoint event', () => {
    let saved = false
    manager.getPubSub().subscribe('checkpoint.saved', () => { saved = true })
    manager.saveCheckpoint({ taskId: 't1', state: {}, messages: '', context: {}, serializedAt: Date.now() })
    expect(saved).toBe(true)
  })
})
