// 任务图 - 管理任务依赖关系和DAG操作

import type { TaskV2, TaskStatus, TaskResult, Checkpoint, TaskGraph } from './types.js'

export class TaskGraphManager {
  private nodes: Map<string, TaskV2> = new Map()
  private edges: Map<string, string[]> = new Map()

  addTask(task: TaskV2): void {
    this.nodes.set(task.id, task)
    this.edges.set(task.id, [...task.dependencies])
  }

  removeTask(taskId: string): boolean {
    if (!this.nodes.has(taskId)) return false
    this.nodes.delete(taskId)
    this.edges.delete(taskId)
    for (const [id, deps] of this.edges) {
      this.edges.set(id, deps.filter(d => d !== taskId))
    }
    return true
  }

  getTask(taskId: string): TaskV2 | null {
    return this.nodes.get(taskId) ?? null
  }

  getAllTasks(): TaskV2[] {
    return Array.from(this.nodes.values())
  }

  getDependencies(taskId: string): string[] {
    return this.edges.get(taskId) ?? []
  }

  getDependents(taskId: string): string[] {
    const dependents: string[] = []
    for (const [id, deps] of this.edges) {
      if (deps.includes(taskId)) {
        dependents.push(id)
      }
    }
    return dependents
  }

  addDependency(taskId: string, dependsOn: string): boolean {
    if (!this.nodes.has(taskId) || !this.nodes.has(dependsOn)) return false
    const deps = this.edges.get(taskId) ?? []
    if (!deps.includes(dependsOn)) {
      deps.push(dependsOn)
      this.edges.set(taskId, deps)
      const task = this.nodes.get(taskId)!
      task.dependencies = deps
      task.updatedAt = Date.now()
    }
    return true
  }

  removeDependency(taskId: string, dependsOn: string): boolean {
    const deps = this.edges.get(taskId)
    if (!deps) return false
    const idx = deps.indexOf(dependsOn)
    if (idx === -1) return false
    deps.splice(idx, 1)
    this.edges.set(taskId, deps)
    const task = this.nodes.get(taskId)!
    task.dependencies = deps
    task.updatedAt = Date.now()
    return true
  }

  hasCycle(): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (node: string): boolean => {
      visited.add(node)
      recursionStack.add(node)

      const deps = this.edges.get(node) ?? []
      for (const dep of deps) {
        if (!visited.has(dep)) {
          if (dfs(dep)) return true
        } else if (recursionStack.has(dep)) {
          return true
        }
      }

      recursionStack.delete(node)
      return false
    }

    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true
      }
    }

    return false
  }

  updateTaskStatus(taskId: string, status: TaskStatus): boolean {
    const task = this.nodes.get(taskId)
    if (!task) return false
    task.status = status
    task.updatedAt = Date.now()
    return true
  }

  setTaskResult(taskId: string, result: TaskResult): boolean {
    const task = this.nodes.get(taskId)
    if (!task) return false
    task.result = result
    task.status = result.success ? 'completed' : 'failed'
    task.updatedAt = Date.now()
    return true
  }

  addCheckpoint(taskId: string, checkpoint: Omit<Checkpoint, 'id' | 'createdAt' | 'taskId'>): Checkpoint | null {
    const task = this.nodes.get(taskId)
    if (!task) return null
    const cp: Checkpoint = {
      ...checkpoint,
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taskId,
      createdAt: Date.now()
    }
    task.checkpoints.push(cp)
    task.updatedAt = Date.now()
    return cp
  }

  getReadyTasks(): TaskV2[] {
    const ready: TaskV2[] = []
    for (const [taskId, deps] of this.edges) {
      const task = this.nodes.get(taskId)
      if (!task || task.status !== 'pending') continue
      const allDepsCompleted = deps.every(depId => {
        const depTask = this.nodes.get(depId)
        return depTask?.status === 'completed'
      })
      if (allDepsCompleted) {
        ready.push(task)
      }
    }
    return ready
  }

  getBlockedTasks(): string[] {
    const blocked: string[] = []
    for (const [taskId, deps] of this.edges) {
      const task = this.nodes.get(taskId)
      if (!task || task.status !== 'pending') continue
      const hasFailedDep = deps.some(depId => {
        const depTask = this.nodes.get(depId)
        return depTask?.status === 'failed' || depTask?.status === 'cancelled'
      })
      if (hasFailedDep) {
        blocked.push(taskId)
      }
    }
    return blocked
  }

  exportGraph(): TaskGraph {
    return {
      nodes: new Map(this.nodes),
      edges: new Map(this.edges)
    }
  }

  clear(): void {
    this.nodes.clear()
    this.edges.clear()
  }
}
