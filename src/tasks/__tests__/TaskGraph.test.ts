import { describe, it, expect, beforeEach } from 'vitest'
import { TaskGraphManager } from '../TaskGraph.js'
import type { TaskV2, TaskResult } from '../types.js'

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

describe('TaskGraphManager', () => {
  let graph: TaskGraphManager

  beforeEach(() => {
    graph = new TaskGraphManager()
  })

  describe('addTask', () => {
    it('adds a task to the graph', () => {
      const task = createTask()
      graph.addTask(task)
      expect(graph.getTask('task-1')).toEqual(task)
    })

    it('stores task dependencies as edges', () => {
      const task1 = createTask({ id: 't1' })
      const task2 = createTask({ id: 't2', dependencies: ['t1'] })
      graph.addTask(task1)
      graph.addTask(task2)
      expect(graph.getDependencies('t2')).toEqual(['t1'])
    })
  })

  describe('removeTask', () => {
    it('removes a task and its edges', () => {
      const task = createTask()
      graph.addTask(task)
      expect(graph.removeTask('task-1')).toBe(true)
      expect(graph.getTask('task-1')).toBeNull()
    })

    it('returns false for non-existent task', () => {
      expect(graph.removeTask('nonexistent')).toBe(false)
    })

    it('removes task from other tasks dependencies', () => {
      const t1 = createTask({ id: 't1' })
      const t2 = createTask({ id: 't2', dependencies: ['t1'] })
      graph.addTask(t1)
      graph.addTask(t2)
      graph.removeTask('t1')
      expect(graph.getDependencies('t2')).toEqual([])
    })
  })

  describe('getTask / getAllTasks', () => {
    it('returns null for missing task', () => {
      expect(graph.getTask('missing')).toBeNull()
    })

    it('returns all tasks', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2' }))
      expect(graph.getAllTasks()).toHaveLength(2)
    })
  })

  describe('dependencies', () => {
    it('returns empty array for task with no dependencies', () => {
      graph.addTask(createTask())
      expect(graph.getDependencies('task-1')).toEqual([])
    })

    it('adds a dependency', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2' }))
      expect(graph.addDependency('t2', 't1')).toBe(true)
      expect(graph.getDependencies('t2')).toContain('t1')
    })

    it('returns false for adding dependency with missing task', () => {
      graph.addTask(createTask({ id: 't1' }))
      expect(graph.addDependency('nonexistent', 't1')).toBe(false)
      expect(graph.addDependency('t1', 'nonexistent')).toBe(false)
    })

    it('removes a dependency', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      expect(graph.removeDependency('t2', 't1')).toBe(true)
      expect(graph.getDependencies('t2')).toEqual([])
    })

    it('returns false for removing non-existent dependency', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2' }))
      expect(graph.removeDependency('t2', 't1')).toBe(false)
    })

    it('finds dependents of a task', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.addTask(createTask({ id: 't3', dependencies: ['t1'] }))
      const dependents = graph.getDependents('t1')
      expect(dependents).toContain('t2')
      expect(dependents).toContain('t3')
      expect(dependents).toHaveLength(2)
    })
  })

  describe('hasCycle', () => {
    it('detects no cycle in linear dependency chain', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.addTask(createTask({ id: 't3', dependencies: ['t2'] }))
      expect(graph.hasCycle()).toBe(false)
    })

    it('detects a cycle', () => {
      graph.addTask(createTask({ id: 't1', dependencies: ['t3'] }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.addTask(createTask({ id: 't3', dependencies: ['t2'] }))
      expect(graph.hasCycle()).toBe(true)
    })

    it('returns false for empty graph', () => {
      expect(graph.hasCycle()).toBe(false)
    })

    it('returns false for single task', () => {
      graph.addTask(createTask())
      expect(graph.hasCycle()).toBe(false)
    })
  })

  describe('updateTaskStatus', () => {
    it('updates task status', () => {
      graph.addTask(createTask())
      expect(graph.updateTaskStatus('task-1', 'running')).toBe(true)
      expect(graph.getTask('task-1')?.status).toBe('running')
    })

    it('returns false for missing task', () => {
      expect(graph.updateTaskStatus('missing', 'running')).toBe(false)
    })
  })

  describe('setTaskResult', () => {
    it('sets result and marks task as completed on success', () => {
      graph.addTask(createTask())
      const result: TaskResult = { output: 'done', success: true }
      expect(graph.setTaskResult('task-1', result)).toBe(true)
      const task = graph.getTask('task-1')!
      expect(task.result).toEqual(result)
      expect(task.status).toBe('completed')
    })

    it('sets result and marks task as failed on failure', () => {
      graph.addTask(createTask())
      const result: TaskResult = { output: '', success: false, error: 'boom' }
      graph.setTaskResult('task-1', result)
      expect(graph.getTask('task-1')?.status).toBe('failed')
    })
  })

  describe('checkpoints', () => {
    it('adds a checkpoint', () => {
      graph.addTask(createTask())
      const cp = graph.addCheckpoint('task-1', {
        description: 'midway',
        state: { progress: 50 }
      })
      expect(cp).not.toBeNull()
      expect(cp?.description).toBe('midway')
      expect(cp?.state).toEqual({ progress: 50 })
    })

    it('returns null for missing task', () => {
      expect(graph.addCheckpoint('missing', { description: 'x', state: {} })).toBeNull()
    })
  })

  describe('getReadyTasks', () => {
    it('returns tasks with no dependencies', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2' }))
      const ready = graph.getReadyTasks()
      expect(ready).toHaveLength(2)
    })

    it('returns tasks whose dependencies are completed', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.updateTaskStatus('t1', 'completed')
      const ready = graph.getReadyTasks()
      expect(ready).toHaveLength(1)
      expect(ready[0].id).toBe('t2')
    })

    it('does not return tasks with incomplete dependencies', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      const ready = graph.getReadyTasks()
      expect(ready).toHaveLength(1)
      expect(ready[0].id).toBe('t1')
    })

    it('does not return non-pending tasks', () => {
      graph.addTask(createTask({ id: 't1', status: 'completed' }))
      expect(graph.getReadyTasks()).toHaveLength(0)
    })
  })

  describe('getBlockedTasks', () => {
    it('returns tasks with failed dependencies', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.updateTaskStatus('t1', 'failed')
      const blocked = graph.getBlockedTasks()
      expect(blocked).toContain('t2')
    })

    it('returns tasks with cancelled dependencies', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.updateTaskStatus('t1', 'cancelled')
      const blocked = graph.getBlockedTasks()
      expect(blocked).toContain('t2')
    })

    it('does not return tasks with completed dependencies', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      graph.updateTaskStatus('t1', 'completed')
      const blocked = graph.getBlockedTasks()
      expect(blocked).toHaveLength(0)
    })
  })

  describe('exportGraph', () => {
    it('exports the graph structure', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2', dependencies: ['t1'] }))
      const exported = graph.exportGraph()
      expect(exported.nodes.has('t1')).toBe(true)
      expect(exported.nodes.has('t2')).toBe(true)
      expect(exported.edges.get('t2')).toEqual(['t1'])
    })
  })

  describe('clear', () => {
    it('removes all tasks and edges', () => {
      graph.addTask(createTask({ id: 't1' }))
      graph.addTask(createTask({ id: 't2' }))
      graph.clear()
      expect(graph.getAllTasks()).toHaveLength(0)
      expect(graph.hasCycle()).toBe(false)
    })
  })
})
