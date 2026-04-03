// Checkpoint管理器 - 任务状态快照和恢复

import type { Checkpoint } from './types.js'
import { TaskGraphManager } from './TaskGraph.js'

export class CheckpointManager {
  private graph: TaskGraphManager
  private maxCheckpointsPerTask: number

  constructor(graph: TaskGraphManager, maxCheckpointsPerTask = 10) {
    this.graph = graph
    this.maxCheckpointsPerTask = maxCheckpointsPerTask
  }

  createCheckpoint(taskId: string, description: string, state: Record<string, unknown>): Checkpoint | null {
    const task = this.graph.getTask(taskId)
    if (!task) return null

    const checkpoint = this.graph.addCheckpoint(taskId, {
      description,
      state
    })

    if (!checkpoint) return null

    this.enforceLimit(taskId)

    return checkpoint
  }

  getCheckpoints(taskId: string): Checkpoint[] {
    const task = this.graph.getTask(taskId)
    return task?.checkpoints ?? []
  }

  getLatestCheckpoint(taskId: string): Checkpoint | null {
    const checkpoints = this.getCheckpoints(taskId)
    if (checkpoints.length === 0) return null
    return checkpoints[checkpoints.length - 1]
  }

  restoreCheckpoint(taskId: string, checkpointId: string): Record<string, unknown> | null {
    const task = this.graph.getTask(taskId)
    if (!task) return null

    const checkpoint = task.checkpoints.find(cp => cp.id === checkpointId)
    if (!checkpoint) return null

    return JSON.parse(JSON.stringify(checkpoint.state))
  }

  deleteCheckpoint(taskId: string, checkpointId: string): boolean {
    const task = this.graph.getTask(taskId)
    if (!task) return false

    const idx = task.checkpoints.findIndex(cp => cp.id === checkpointId)
    if (idx === -1) return false

    task.checkpoints.splice(idx, 1)
    task.updatedAt = Date.now()
    return true
  }

  clearCheckpoints(taskId: string): number {
    const task = this.graph.getTask(taskId)
    if (!task) return 0

    const count = task.checkpoints.length
    task.checkpoints = []
    task.updatedAt = Date.now()
    return count
  }

  getCheckpointCount(taskId: string): number {
    return this.getCheckpoints(taskId).length
  }

  private enforceLimit(taskId: string): void {
    const task = this.graph.getTask(taskId)
    if (!task) return

    while (task.checkpoints.length > this.maxCheckpointsPerTask) {
      task.checkpoints.shift()
    }
  }
}
