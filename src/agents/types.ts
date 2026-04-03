// Multi-Agent 协作系统类型定义

export type AgentRole = 'planner' | 'coder' | 'reviewer' | 'tester' | 'researcher' | 'executor' | 'orchestrator'

export type AgentStatus = 'idle' | 'working' | 'waiting' | 'blocked' | 'completed'

export interface AgentIdentity {
  id: string
  name: string
  role: AgentRole
  capabilities: string[]
  systemPrompt: string
}

export interface AgentMessage {
  id: string
  from: string
  to: string | '*'
  type: 'task' | 'result' | 'query' | 'response' | 'error' | 'broadcast'
  content: string
  metadata?: Record<string, unknown>
  timestamp: number
  replyTo?: string
}

export interface AgentTask {
  id: string
  assignedTo: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  result?: string
  createdAt: number
  completedAt?: number
}

export interface CollaborationResult {
  taskId: string
  agents: string[]
  steps: number
  duration: number
  success: boolean
  output: string
}
