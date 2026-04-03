// 任务调度器 - 按依赖顺序调度任务

import type { TaskV2, TaskPriority, ScheduleResult } from './types.js'
import { TaskGraphManager } from './TaskGraph.js'

export class TaskScheduler {
  private graph: TaskGraphManager

  constructor(graph: TaskGraphManager) {
    this.graph = graph
  }

  schedule(): ScheduleResult {
    if (this.graph.hasCycle()) {
      return {
        orderedTasks: [],
        hasCycle: true,
        blockedTasks: []
      }
    }

    const ordered = this.topologicalSort()
    const blocked = this.graph.getBlockedTasks()

    return {
      orderedTasks: ordered,
      hasCycle: false,
      blockedTasks: blocked
    }
  }

  getNextTask(): TaskV2 | null {
    const readyTasks = this.graph.getReadyTasks()
    if (readyTasks.length === 0) return null
    return this.pickHighestPriority(readyTasks)
  }

  getParallelGroups(): TaskV2[][] {
    if (this.graph.hasCycle()) return []

    const groups: TaskV2[][] = []
    const scheduled = new Set<string>()
    const allTasks = this.graph.getAllTasks()
    const pendingTasks = allTasks.filter(t => t.status === 'pending')

    while (scheduled.size < pendingTasks.length) {
      const group: TaskV2[] = []
      for (const task of pendingTasks) {
        if (scheduled.has(task.id)) continue
        const deps = this.graph.getDependencies(task.id)
        const allDepsScheduled = deps.every(dep => scheduled.has(dep) || this.graph.getTask(dep)?.status === 'completed')
        if (allDepsScheduled) {
          group.push(task)
        }
      }
      if (group.length === 0) break
      group.sort((a, b) => this.priorityValue(b.priority) - this.priorityValue(a.priority))
      groups.push(group)
      for (const task of group) {
        scheduled.add(task.id)
      }
    }

    return groups
  }

  private topologicalSort(): TaskV2[] {
    const visited = new Set<string>()
    const result: TaskV2[] = []

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return
      visited.add(taskId)

      const deps = this.graph.getDependencies(taskId)
      for (const dep of deps) {
        visit(dep)
      }

      const task = this.graph.getTask(taskId)
      if (task) {
        result.push(task)
      }
    }

    const allTasks = this.graph.getAllTasks()
    allTasks.sort((a, b) => this.priorityValue(b.priority) - this.priorityValue(a.priority))

    for (const task of allTasks) {
      visit(task.id)
    }

    return result
  }

  private pickHighestPriority(tasks: TaskV2[]): TaskV2 {
    return tasks.reduce((best, current) =>
      this.priorityValue(current.priority) > this.priorityValue(best.priority) ? current : best
    )
  }

  private priorityValue(priority: TaskPriority): number {
    switch (priority) {
      case 'critical': return 4
      case 'high': return 3
      case 'medium': return 2
      case 'low': return 1
    }
  }
}
