// REPL会话管理器

import type { ChatMessage } from '../providers/base/types.js'
import type { Provider } from '../providers/base/Provider.js'
import type { MemoryManager } from '../memory/MemoryManager.js'
import type { CompactionEngine } from '../compaction/CompactionEngine.js'
import type { CostTracker } from '../harness/CostTracker.js'

export type SlashCommand = {
  name: string
  description: string
  handler: (args: string) => Promise<string>
}

export interface SessionState {
  id: string
  messages: ChatMessage[]
  messageCount: number
  tokenCount: number
  startedAt: number
  lastActivityAt: number
}

export class REPLSession {
  private state: SessionState
  private provider: Provider
  private commands: Map<string, SlashCommand> = new Map()
  private memoryManager?: MemoryManager
  private compactionEngine?: CompactionEngine
  private costTracker?: CostTracker

  constructor(provider: Provider, options: {
    memoryManager?: MemoryManager
    compactionEngine?: CompactionEngine
    costTracker?: CostTracker
  } = {}) {
    this.provider = provider
    this.memoryManager = options.memoryManager
    this.compactionEngine = options.compactionEngine
    this.costTracker = options.costTracker
    this.state = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      messages: [],
      messageCount: 0,
      tokenCount: 0,
      startedAt: Date.now(),
      lastActivityAt: Date.now()
    }
  }

  registerCommand(cmd: SlashCommand): void {
    this.commands.set(cmd.name, cmd)
  }

  getCommands(): SlashCommand[] {
    return Array.from(this.commands.values())
  }

  async handleInput(input: string): Promise<string> {
    this.state.lastActivityAt = Date.now()

    if (input.startsWith('/')) {
      return this.executeCommand(input)
    }

    return this.processMessage(input)
  }

  private async executeCommand(input: string): Promise<string> {
    const parts = input.slice(1).split(' ')
    const cmdName = parts[0].toLowerCase()
    const args = parts.slice(1).join(' ')

    const cmd = this.commands.get(cmdName)
    if (!cmd) {
      return `Unknown command: /${cmdName}. Type /help for available commands.`
    }

    try {
      return await cmd.handler(args)
    } catch (err: unknown) {
      return `Command error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  }

  private async processMessage(input: string): Promise<string> {
    const userMsg: ChatMessage = { role: 'user', content: input }
    this.state.messages.push(userMsg)
    this.state.messageCount++

    try {
      const response = await this.provider.chat(
        this.state.messages,
        { model: this.provider.listModels()[0]?.id ?? '' }
      )

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
      }
      this.state.messages.push(assistantMsg)
      this.state.messageCount++
      this.state.tokenCount += response.usage.inputTokens + response.usage.outputTokens

      return response.content
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      }
      this.state.messages.push(errorMsg)
      return typeof errorMsg.content === 'string' ? errorMsg.content : JSON.stringify(errorMsg.content)
    }
  }

  getState(): SessionState {
    return { ...this.state, messages: [...this.state.messages] }
  }

  getMessages(): ChatMessage[] {
    return [...this.state.messages]
  }

  getMessageCount(): number {
    return this.state.messageCount
  }

  getTokenCount(): number {
    return this.state.tokenCount
  }

  getMemoryManager(): MemoryManager | undefined {
    return this.memoryManager
  }

  getCompactionEngine(): CompactionEngine | undefined {
    return this.compactionEngine
  }

  getCostTracker(): CostTracker | undefined {
    return this.costTracker
  }

  clearHistory(): void {
    this.state.messages = []
    this.state.messageCount = 0
    this.state.tokenCount = 0
  }
}
