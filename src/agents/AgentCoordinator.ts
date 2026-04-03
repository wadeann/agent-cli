// Agent协调器 - 管理多Agent协作

import type { AgentIdentity, AgentStatus, AgentTask, CollaborationResult, AgentRole } from './types.js'
import { MessageBus } from './MessageBus.js'

export type AgentHandler = (task: AgentTask, context: Record<string, unknown>) => Promise<string>

export class AgentCoordinator {
  private agents: Map<string, { identity: AgentIdentity; status: AgentStatus; handler: AgentHandler }> = new Map()
  private bus: MessageBus
  private tasks: Map<string, AgentTask> = new Map()
  private results: CollaborationResult[] = []

  constructor(bus?: MessageBus) {
    this.bus = bus ?? new MessageBus()
  }

  registerAgent(identity: AgentIdentity, handler: AgentHandler): void {
    this.agents.set(identity.id, { identity, status: 'idle', handler })
  }

  async dispatchTask(task: Omit<AgentTask, 'status' | 'createdAt'>): Promise<AgentTask> {
    const fullTask: AgentTask = { ...task, status: 'pending', createdAt: Date.now() }
    this.tasks.set(fullTask.id, fullTask)

    const agent = this.agents.get(task.assignedTo)
    if (!agent) {
      fullTask.status = 'failed'
      fullTask.result = `Agent ${task.assignedTo} not found`
      return fullTask
    }

    agent.status = 'working'
    fullTask.status = 'in_progress'

    this.bus.send({
      from: 'coordinator',
      to: task.assignedTo,
      type: 'task',
      content: task.description,
      metadata: { taskId: task.id }
    })

    try {
      const result = await agent.handler(fullTask, {})
      fullTask.status = 'completed'
      fullTask.result = result
      fullTask.completedAt = Date.now()
      agent.status = 'idle'

      this.bus.send({
        from: task.assignedTo,
        to: 'coordinator',
        type: 'result',
        content: result,
        metadata: { taskId: task.id },
        replyTo: task.id
      })
    } catch (err: unknown) {
      fullTask.status = 'failed'
      fullTask.result = err instanceof Error ? err.message : 'Unknown error'
      fullTask.completedAt = Date.now()
      agent.status = 'idle'

      this.bus.send({
        from: task.assignedTo,
        to: 'coordinator',
        type: 'error',
        content: fullTask.result,
        metadata: { taskId: task.id }
      })
    }

    return fullTask
  }

  async collaborate(agents: string[], taskDescription: string): Promise<CollaborationResult> {
    const start = Date.now()
    let currentResult = ''

    for (let i = 0; i < agents.length; i++) {
      const agentId = agents[i]
      const task: AgentTask = {
        id: `collab-${Date.now()}-${i}`,
        assignedTo: agentId,
        description: i === 0 ? taskDescription : `Build on previous result: ${currentResult}`,
        priority: 'medium',
        status: 'pending',
        createdAt: Date.now()
      }

      const result = await this.dispatchTask(task)
      currentResult = result.result ?? ''

      if (result.status === 'failed') {
        return {
          taskId: task.id,
          agents,
          steps: i + 1,
          duration: Date.now() - start,
          success: false,
          output: currentResult
        }
      }
    }

    const collabResult: CollaborationResult = {
      taskId: `collab-${Date.now()}`,
      agents,
      steps: agents.length,
      duration: Date.now() - start,
      success: true,
      output: currentResult
    }
    this.results.push(collabResult)
    return collabResult
  }

  getAgentStatus(agentId: string): { identity: AgentIdentity; status: AgentStatus } | null {
    const agent = this.agents.get(agentId)
    if (!agent) return null
    return { identity: agent.identity, status: agent.status }
  }

  getAllStatuses(): Array<{ id: string; name: string; role: AgentRole; status: AgentStatus }> {
    return Array.from(this.agents.values()).map(a => ({
      id: a.identity.id,
      name: a.identity.name,
      role: a.identity.role,
      status: a.status
    }))
  }

  getTask(taskId: string): AgentTask | null {
    return this.tasks.get(taskId) ?? null
  }

  getCollaborationHistory(): CollaborationResult[] {
    return [...this.results]
  }

  getMessageBus(): MessageBus {
    return this.bus
  }

  getAgentCount(): number {
    return this.agents.size
  }

  reset(): void {
    for (const agent of this.agents.values()) agent.status = 'idle'
    this.tasks.clear()
    this.results = []
    this.bus.clear()
  }
}
