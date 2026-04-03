// 消息总线 - Agent间异步通信

import type { AgentMessage } from './types.js'

type MessageHandler = (msg: AgentMessage) => void | Promise<void>

export class MessageBus {
  private messages: AgentMessage[] = []
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private broadcastHandlers: Set<MessageHandler> = new Set()
  private maxHistory: number

  constructor(maxHistory = 1000) {
    this.maxHistory = maxHistory
  }

  send(msg: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage {
    const fullMsg: AgentMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now()
    }
    this.messages.push(fullMsg)
    if (this.messages.length > this.maxHistory) this.messages.shift()

    this.deliver(fullMsg)
    return fullMsg
  }

  async sendAsync(msg: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<AgentMessage> {
    const fullMsg = this.send(msg)
    return fullMsg
  }

  subscribe(agentId: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(agentId)) this.handlers.set(agentId, new Set())
    this.handlers.get(agentId)!.add(handler)
    return () => this.handlers.get(agentId)?.delete(handler)
  }

  onBroadcast(handler: MessageHandler): () => void {
    this.broadcastHandlers.add(handler)
    return () => this.broadcastHandlers.delete(handler)
  }

  getHistory(agentId?: string, limit = 50): AgentMessage[] {
    if (agentId) {
      return this.messages
        .filter(m => m.from === agentId || m.to === agentId || m.to === '*')
        .slice(-limit)
    }
    return this.messages.slice(-limit)
  }

  getConversation(agent1: string, agent2: string): AgentMessage[] {
    return this.messages.filter(m =>
      (m.from === agent1 && m.to === agent2) ||
      (m.from === agent2 && m.to === agent1)
    )
  }

  getMessageCount(): number {
    return this.messages.length
  }

  clear(): void {
    this.messages = []
  }

  private deliver(msg: AgentMessage): void {
    // Deliver broadcast to all subscribers
    if (msg.to === '*' || msg.type === 'broadcast') {
      for (const [, handlers] of this.handlers) {
        for (const handler of handlers) handler(msg)
      }
      for (const handler of this.broadcastHandlers) handler(msg)
    } else {
      // Deliver to specific recipient
      const handlers = this.handlers.get(msg.to)
      if (handlers) {
        for (const handler of handlers) handler(msg)
      }
    }

    // Deliver to sender's own handlers (for reply tracking)
    const senderHandlers = this.handlers.get(msg.from)
    if (senderHandlers) {
      for (const handler of senderHandlers) handler(msg)
    }
  }
}
