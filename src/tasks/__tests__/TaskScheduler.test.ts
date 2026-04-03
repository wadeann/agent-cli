import { describe, it, expect, beforeEach } from 'vitest'
import { TaskGraphManager } from '../TaskGraph.js'
import { TaskScheduler } from '../TaskScheduler.js'
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

describe('TaskScheduler', () => {
  let graph: TaskGraphManager
  let scheduler: TaskScheduler

  beforeEach(() => {
    graph = new TaskGraphManager()
    scheduler = new TaskScheduler(graph)
  })

  describe('schedule', () => {
    it('returns ordered tasks for linear dependency chain', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.addTask(createTask({ id: 't3', dependencies: ['t2'] }))
      const result = scheduler.schedule()
      expect(result.hasCycle).toBe(false)
      expect(result.orderedTasks).toHaveLength(3)
      const ids = result.orderedTasks.map(t => t.id)
      expect(ids.indexOf('t1')).toBeLessThan(ids.indexOf('t2'))
      expect(ids.indexOf('t2')).toBeLessThan(ids.indexOf('t3'))
    })

    it('detects cycles', () => {
      graph.addTask(createTask({ id: 't1', dependencies: ['t3'] }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.addTask(createTask({ id: 't3', dependencies: ['t2'] }))
      const result = scheduler.schedule()
      expect(result.hasCycle).toBe(true)
      expect(result.orderedTasks).toHaveLength(0)
    })

    it('identifies blocked tasks', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.updateTaskStatus('t1', 'failed')
      const result = scheduler.schedule()
      expect(result.blockedTasks).toContain('t2')
    })

    it('handles empty graph', () => {
      const result = scheduler.schedule()
      expect(result.hasCycle).toBe(false)
      expect(result.orderedTasks).toHaveLength(0)
      expect(result.blockedTasks).toHaveLength(0)
    })

    it('orders by priority when no dependencies', () => {
      graph.addTask(createTask({ id: 't1', priority: 'low' }))
      graph.addTask(createTask({ id: 't2', priority: 'critical' }))
      graph.addTask(createTask({ id: 't3', priority: 'high' }))
      const result = scheduler.schedule()
      expect(result.orderedTasks[0].priority).toBe('critical')
    })
  })

  describe('getNextTask', () => {
    it('returns a ready task', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      const next = scheduler.getNextTask()
      expect(next).not.toBeNull()
      expect(next?.id).toBe('t1')
    })

    it('returns null when no tasks are ready', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.updateTaskStatus('t1', 'running')
      const next = scheduler.getNextTask()
      expect(next).toBeNull()
    })

    it('returns highest priority ready task', () => {
      graph.addTask(createTask({ id: 't1', priority: 'low' }))
      graph.addTask(createTask({ id: 't2', priority: 'high' }))
      const next = scheduler.getNextTask()
      expect(next?.id).toBe('t2')
    })

    it('returns null for empty graph', () => {
      expect(scheduler.getNextTask()).toBeNull()
    })

    it('returns next task after completing dependency', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      scheduler.getNextTask()
      graph.updateTaskStatus('t1', 'completed')
      const next = scheduler.getNextTask()
      expect(next?.id).toBe('t2')
    })
  })

  describe('getParallelGroups', () => {
    it('groups independent tasks together', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2' }))
      graph.addTask(createTask({ id: 't3', dependencies: ['t1', 't2'] }))
      const groups = scheduler.getParallelGroups()
      expect(groups).toHaveLength(2)
      expect(groups[0]).toHaveLength(2)
      expect(groups[1]).toHaveLength(1)
    })

    it('returns empty for cyclic graph', () => {
      graph.addTask(createTask({ id: 't1', dependencies: ['t2'] }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      const groups = scheduler.getParallelGroups()
      expect(groups).toHaveLength(0)
    })

    it('handles single task', () => {
      graph.addTask(createTask())
      const groups = scheduler.getParallelGroups()
      expect(groups).toHaveLength(1)
      expect(groups[0]).toHaveLength(1)
    })

    it('orders by priority within groups', () => {
      graph.addTask(createTask({ id: 't1', priority: 'low' }))
      graph.addTask(createTask({ id: 't2', priority: 'critical' }))
      const groups = scheduler.getParallelGroups()
      expect(groups[0][0].priority).toBe('critical')
    })

    it('skips non-pending tasks', () => {
      graph.addTask(createTask({ id: 't1', status: 'completed' }))
      graph.addTask(createTask({ id: 't2' }))
      const groups = scheduler.getParallelGroups()
      expect(groups).toHaveLength(1)
      expect(groups[0]).toHaveLength(1)
      expect(groups[0][0].id).toBe('t2')
    })
  })
})
