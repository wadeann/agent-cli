// Router-Worker 架构 - 异步任务分发 + Pub/Sub

import type { RouterTask, WorkerResult, PubSubMessage, CheckpointData } from './types.js'

type TaskHandler = (task: RouterTask) => Promise<WorkerResult>

export class PubSub {
  private topics: Map<string, Set<(msg: PubSubMessage) => void>> = new Map()

  subscribe(topic: string, handler: (msg: PubSubMessage) => void): () => void {
    if (!this.topics.has(topic)) this.topics.set(topic, new Set())
    this.topics.get(topic)!.add(handler)
    return () => this.topics.get(topic)?.delete(handler)
  }

  publish(topic: string, data: Record<string, unknown>): void {
    const msg: PubSubMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      topic,
      data,
      timestamp: Date.now()
    }
    const handlers = this.topics.get(topic)
    if (handlers) {
      for (const handler of handlers) handler(msg)
    }
  }

  getTopics(): string[] {
    return Array.from(this.topics.keys())
  }

  clear(): void {
    this.topics.clear()
  }
}

export class RouterWorkerManager {
  private pubsub: PubSub
  private workers: Map<string, TaskHandler> = new Map()
  private pendingTasks: Map<string, RouterTask> = new Map()
  private checkpoints: Map<string, CheckpointData> = new Map()
  private taskQueue: RouterTask[] = []
  private processing = false

  constructor() {
    this.pubsub = new PubSub()
  }

  registerWorker(type: string, handler: TaskHandler): void {
    this.workers.set(type, handler)
  }

  dispatchTask(task: RouterTask): void {
    this.taskQueue.push(task)
    this.pendingTasks.set(task.id, task)
    this.pubsub.publish('task.dispatched', { taskId: task.id, type: task.type })
    this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.taskQueue.length === 0) return
    this.processing = true

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!
      const handler = this.workers.get(task.type)

      if (!handler) {
        this.pubsub.publish('task.failed', { taskId: task.id, error: `No worker for type: ${task.type}` })
        this.pendingTasks.delete(task.id)
        continue
      }

      this.pubsub.publish('task.started', { taskId: task.id })

      try {
        const result = await Promise.race([
          handler(task),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Task timeout')), task.timeoutMs ?? 300000)
          )
        ])

        this.pubsub.publish('task.completed', { taskId: task.id, success: result.success })
        this.pendingTasks.delete(task.id)
      } catch (err: unknown) {
        this.pubsub.publish('task.failed', {
          taskId: task.id,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        this.pendingTasks.delete(task.id)
      }
    }

    this.processing = false
  }

  saveCheckpoint(data: CheckpointData): void {
    this.checkpoints.set(data.taskId, data)
    this.pubsub.publish('checkpoint.saved', { taskId: data.taskId })
  }

  loadCheckpoint(taskId: string): CheckpointData | null {
    return this.checkpoints.get(taskId) ?? null
  }

  getPendingTasks(): RouterTask[] {
    return Array.from(this.pendingTasks.values())
  }

  getQueueLength(): number {
    return this.taskQueue.length
  }

  getWorkerTypes(): string[] {
    return Array.from(this.workers.keys())
  }

  getPubSub(): PubSub {
    return this.pubsub
  }
}
