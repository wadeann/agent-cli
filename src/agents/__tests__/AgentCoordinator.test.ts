import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AgentCoordinator } from '../AgentCoordinator.js'
import type { AgentIdentity, AgentTask } from '../types.js'

function createAgent(id: string, name: string, role: string): AgentIdentity {
  return {
    id,
    name,
    role: role as any,
    capabilities: ['test'],
    systemPrompt: `You are ${name}`
  }
}

describe('AgentCoordinator', () => {
  let coordinator: AgentCoordinator

  beforeEach(() => {
    coordinator = new AgentCoordinator()
  })

  describe('registerAgent', () => {
    it('registers an agent with handler', () => {
      const handler = vi.fn().mockResolvedValue('done')
      coordinator.registerAgent(createAgent('coder', 'Coder', 'coder'), handler)
      expect(coordinator.getAgentCount()).toBe(1)
    })

    it('agent receives task messages', async () => {
      const handler = vi.fn().mockResolvedValue('result')
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), handler)
      await coordinator.dispatchTask({
        id: 't1',
        assignedTo: 'a',
        description: 'Do work',
        priority: 'medium'
      })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('dispatchTask', () => {
    it('dispatches task and returns result', async () => {
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), async () => 'completed work')
      const result = await coordinator.dispatchTask({
        id: 't1',
        assignedTo: 'a',
        description: 'Do work',
        priority: 'high'
      })
      expect(result.status).toBe('completed')
      expect(result.result).toBe('completed work')
    })

    it('handles task failure', async () => {
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), async () => { throw new Error('fail') })
      const result = await coordinator.dispatchTask({
        id: 't1',
        assignedTo: 'a',
        description: 'Do work',
        priority: 'medium'
      })
      expect(result.status).toBe('failed')
      expect(result.result).toContain('fail')
    })

    it('handles missing agent', async () => {
      const result = await coordinator.dispatchTask({
        id: 't1',
        assignedTo: 'nonexistent',
        description: 'Do work',
        priority: 'medium'
      })
      expect(result.status).toBe('failed')
      expect(result.result).toContain('not found')
    })

    it('updates agent status during execution', async () => {
      let capturedStatus = ''
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), async () => {
        capturedStatus = coordinator.getAgentStatus('a')?.status ?? ''
        await new Promise(r => setTimeout(r, 10))
        return 'done'
      })
      await coordinator.dispatchTask({ id: 't1', assignedTo: 'a', description: 'work', priority: 'medium' })
      expect(capturedStatus).toBe('working')
      expect(coordinator.getAgentStatus('a')?.status).toBe('idle')
    })

    it('publishes messages to bus', async () => {
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), async () => 'done')
      await coordinator.dispatchTask({ id: 't1', assignedTo: 'a', description: 'work', priority: 'medium' })
      const history = coordinator.getMessageBus().getHistory()
      expect(history.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('collaborate', () => {
    it('chains multiple agents in sequence', async () => {
      coordinator.registerAgent(createAgent('planner', 'Planner', 'planner'), async () => 'plan created')
      coordinator.registerAgent(createAgent('coder', 'Coder', 'coder'), async (task) => `code written based on: ${task.description.slice(0, 20)}`)
      coordinator.registerAgent(createAgent('reviewer', 'Reviewer', 'reviewer'), async () => 'review passed')

      const result = await coordinator.collaborate(['planner', 'coder', 'reviewer'], 'Build a feature')
      expect(result.success).toBe(true)
      expect(result.steps).toBe(3)
      expect(result.agents).toEqual(['planner', 'coder', 'reviewer'])
      expect(result.output).toContain('review passed')
    })

    it('stops on first failure', async () => {
      coordinator.registerAgent(createAgent('a', 'A', 'planner'), async () => 'plan done')
      coordinator.registerAgent(createAgent('b', 'B', 'coder'), async () => { throw new Error('coding failed') })
      coordinator.registerAgent(createAgent('c', 'C', 'reviewer'), async () => 'review done')

      const result = await coordinator.collaborate(['a', 'b', 'c'], 'Build something')
      expect(result.success).toBe(false)
      expect(result.steps).toBe(2)
    })

    it('tracks collaboration duration', async () => {
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), async () => {
        await new Promise(r => setTimeout(r, 50))
        return 'done'
      })
      const result = await coordinator.collaborate(['a'], 'Task')
      expect(result.duration).toBeGreaterThanOrEqual(40)
    })
  })

  describe('getAgentStatus', () => {
    it('returns status for registered agent', () => {
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), async () => 'done')
      const status = coordinator.getAgentStatus('a')
      expect(status).not.toBeNull()
      expect(status?.identity.name).toBe('A')
      expect(status?.status).toBe('idle')
    })

    it('returns null for unknown agent', () => {
      expect(coordinator.getAgentStatus('missing')).toBeNull()
    })
  })

  describe('getAllStatuses', () => {
    it('returns all agent statuses', () => {
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), async () => 'done')
      coordinator.registerAgent(createAgent('b', 'B', 'reviewer'), async () => 'done')
      const statuses = coordinator.getAllStatuses()
      expect(statuses).toHaveLength(2)
    })
  })

  describe('getTask', () => {
    it('returns task by ID', async () => {
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), async () => 'done')
      await coordinator.dispatchTask({ id: 't1', assignedTo: 'a', description: 'work', priority: 'medium' })
      const task = coordinator.getTask('t1')
      expect(task).not.toBeNull()
      expect(task?.id).toBe('t1')
    })
  })

  describe('getCollaborationHistory', () => {
    it('returns collaboration results', async () => {
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), async () => 'done')
      await coordinator.collaborate(['a'], 'Task')
      const history = coordinator.getCollaborationHistory()
      expect(history).toHaveLength(1)
      expect(history[0].success).toBe(true)
    })
  })

  describe('reset', () => {
    it('clears all state', async () => {
      coordinator.registerAgent(createAgent('a', 'A', 'coder'), async () => 'done')
      await coordinator.dispatchTask({ id: 't1', assignedTo: 'a', description: 'work', priority: 'medium' })
      coordinator.reset()
      expect(coordinator.getAgentStatus('a')?.status).toBe('idle')
      expect(coordinator.getCollaborationHistory()).toHaveLength(0)
      expect(coordinator.getMessageBus().getMessageCount()).toBe(0)
    })
  })
})
