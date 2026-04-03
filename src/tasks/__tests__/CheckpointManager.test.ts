import { describe, it, expect, beforeEach } from 'vitest'
import { TaskGraphManager } from '../TaskGraph.js'
import { CheckpointManager } from '../CheckpointManager.js'
import type { TaskV2 } from '../types.js'

function createTask(overrides: Partial<TaskV2> = {}): TaskV2 {
  return {
    id: overrides.id ?? 'task-1',
    title: overrides.title ?? 'Test Task',
    description: overrides.description ?? 'A test task',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'medium',
    dependencies: overrides.dependencies ?? [],
    subtasks: overrides.subtasks ?? [],
    checkpoints: overrides.checkpoints ?? [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    maxRetries: overrides.maxRetries ?? 3,
    retryCount: overrides.retryCount ?? 0,
    result: overrides.result
  }
}

describe('CheckpointManager', () => {
  let graph: TaskGraphManager
  let manager: CheckpointManager

  beforeEach(() => {
    graph = new TaskGraphManager()
    manager = new CheckpointManager(graph)
  })

  describe('createCheckpoint', () => {
    it('creates a checkpoint for a task', () => {
      graph.addTask(createTask())
      const cp = manager.createCheckpoint('task-1', 'midway', { progress: 50 })
      expect(cp).not.toBeNull()
      expect(cp?.description).toBe('midway')
      expect(cp?.state).toEqual({ progress: 50 })
      expect(cp?.taskId).toBe('task-1')
      expect(cp?.id).toBeDefined()
      expect(cp?.createdAt).toBeDefined()
    })

    it('returns null for non-existent task', () => {
      const cp = manager.createCheckpoint('missing', 'x', {})
      expect(cp).toBeNull()
    })

    it('enforces max checkpoints limit', () => {
      graph.addTask(createTask())
      const limitedManager = new CheckpointManager(graph, 3)
      limitedManager.createCheckpoint('task-1', 'cp1', { step: 1 })
      limitedManager.createCheckpoint('task-1', 'cp2', { step: 2 })
      limitedManager.createCheckpoint('task-1', 'cp3', { step: 3 })
      limitedManager.createCheckpoint('task-1', 'cp4', { step: 4 })
      expect(limitedManager.getCheckpointCount('task-1')).toBe(3)
      const cps = limitedManager.getCheckpoints('task-1')
      expect(cps[0].state).toEqual({ step: 2 })
      expect(cps[2].state).toEqual({ step: 4 })
    })
  })

  describe('getCheckpoints', () => {
    it('returns empty array for task with no checkpoints', () => {
      graph.addTask(createTask())
      expect(manager.getCheckpoints('task-1')).toEqual([])
    })

    it('returns empty array for non-existent task', () => {
      expect(manager.getCheckpoints('missing')).toEqual([])
    })

    it('returns all checkpoints in order', () => {
      graph.addTask(createTask())
      manager.createCheckpoint('task-1', 'first', { step: 1 })
      manager.createCheckpoint('task-1', 'second', { step: 2 })
      const cps = manager.getCheckpoints('task-1')
      expect(cps).toHaveLength(2)
      expect(cps[0].description).toBe('first')
      expect(cps[1].description).toBe('second')
    })
  })

  describe('getLatestCheckpoint', () => {
    it('returns the most recent checkpoint', () => {
      graph.addTask(createTask())
      manager.createCheckpoint('task-1', 'first', { step: 1 })
      manager.createCheckpoint('task-1', 'second', { step: 2 })
      const latest = manager.getLatestCheckpoint('task-1')
      expect(latest?.description).toBe('second')
    })

    it('returns null for task with no checkpoints', () => {
      graph.addTask(createTask())
      expect(manager.getLatestCheckpoint('task-1')).toBeNull()
    })
  })

  describe('restoreCheckpoint', () => {
    it('restores checkpoint state', () => {
      graph.addTask(createTask())
      const cp = manager.createCheckpoint('task-1', 'save', { data: 'important', count: 42 })
      const state = manager.restoreCheckpoint('task-1', cp!.id)
      expect(state).toEqual({ data: 'important', count: 42 })
    })

    it('returns null for non-existent task', () => {
      expect(manager.restoreCheckpoint('missing', 'cp-1')).toBeNull()
    })

    it('returns null for non-existent checkpoint', () => {
      graph.addTask(createTask())
      expect(manager.restoreCheckpoint('task-1', 'nonexistent')).toBeNull()
    })

    it('returns a copy of state, not reference', () => {
      graph.addTask(createTask())
      const cp = manager.createCheckpoint('task-1', 'save', { nested: { value: 1 } })
      const state = manager.restoreCheckpoint('task-1', cp!.id)
      state!.nested.value = 999
      const state2 = manager.restoreCheckpoint('task-1', cp!.id)
      expect(state2!.nested.value).toBe(1)
    })
  })

  describe('deleteCheckpoint', () => {
    it('deletes a checkpoint', () => {
      graph.addTask(createTask())
      const cp = manager.createCheckpoint('task-1', 'to-delete', {})
      expect(manager.deleteCheckpoint('task-1', cp!.id)).toBe(true)
      expect(manager.getCheckpointCount('task-1')).toBe(0)
    })

    it('returns false for non-existent task', () => {
      expect(manager.deleteCheckpoint('missing', 'cp-1')).toBe(false)
    })

    it('returns false for non-existent checkpoint', () => {
      graph.addTask(createTask())
      expect(manager.deleteCheckpoint('task-1', 'nonexistent')).toBe(false)
    })
  })

  describe('clearCheckpoints', () => {
    it('removes all checkpoints', () => {
      graph.addTask(createTask())
      manager.createCheckpoint('task-1', 'cp1', {})
      manager.createCheckpoint('task-1', 'cp2', {})
      const count = manager.clearCheckpoints('task-1')
      expect(count).toBe(2)
      expect(manager.getCheckpointCount('task-1')).toBe(0)
    })

    it('returns 0 for non-existent task', () => {
      expect(manager.clearCheckpoints('missing')).toBe(0)
    })
  })

  describe('getCheckpointCount', () => {
    it('returns correct count', () => {
      graph.addTask(createTask())
      manager.createCheckpoint('task-1', 'cp1', {})
      manager.createCheckpoint('task-1', 'cp2', {})
      expect(manager.getCheckpointCount('task-1')).toBe(2)
    })

    it('returns 0 for task with no checkpoints', () => {
      graph.addTask(createTask())
      expect(manager.getCheckpointCount('task-1')).toBe(0)
    })
  })
})
