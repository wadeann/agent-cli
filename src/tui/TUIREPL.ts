// TUI REPL - 交互式终端会话

import { TUIRenderer } from './TUIRenderer.js'
import type { Provider } from '../providers/base/Provider.js'
import type { MemoryManager } from '../memory/MemoryManager.js'
import type { CompactionEngine } from '../compaction/CompactionEngine.js'
import type { CostTracker } from '../harness/CostTracker.js'
import type { ChatMessage } from '../providers/base/types.js'

export interface TUIREPLConfig {
  provider: Provider
  memoryManager?: MemoryManager
  compactionEngine?: CompactionEngine
  costTracker?: CostTracker
  model?: string
  title?: string
}

export class TUIREPL {
  private renderer: TUIRenderer
  private provider: Provider
  private memoryManager?: MemoryManager
  private compactionEngine?: CompactionEngine
  private costTracker?: CostTracker
  private model: string
  private messages: ChatMessage[] = []
  private tokenCount = 0
  private requestCount = 0

  constructor(config: TUIREPLConfig) {
    this.provider = config.provider
    this.memoryManager = config.memoryManager
    this.compactionEngine = config.compactionEngine
    this.costTracker = config.costTracker
    this.model = config.model ?? config.provider.listModels()[0]?.id ?? ''

    this.renderer = new TUIRenderer({
      title: config.title ?? `Agent CLI — ${config.provider.providerName}`,
      showStatusBar: true,
      showCost: true,
      prompt: '❯ '
    })

    process.stdout.on('resize', () => this.renderer.resize())
  }

  start(): void {
    this.renderer.addLine('Welcome to Agent CLI', { color: 'brightCyan', bold: true })
    this.renderer.addLine(`Model: ${this.model}`, { color: 'gray', dim: true })
    this.renderer.addLine('Type /help for commands, Ctrl+C to quit', { color: 'gray', dim: true })
    this.renderer.addSeparator()
    this.renderer.setStatus('Ready')

    if (this.costTracker) {
      this.updateCost()
    }

    this.renderer.start((line: string) => this.handleInput(line))
  }

  stop(): void {
    this.renderer.stop()
  }

  private async handleInput(line: string): Promise<void> {
    if (line.startsWith('/')) {
      this.handleCommand(line)
      return
    }

    await this.processMessage(line)
  }

  private handleCommand(line: string): void {
    const parts = line.slice(1).split(' ')
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1).join(' ')

    switch (cmd) {
      case 'help':
        this.renderer.addLine('Commands:', { color: 'brightCyan', bold: true })
        this.renderer.addLine('  /help          Show this help', { color: 'gray' })
        this.renderer.addLine('  /clear         Clear history', { color: 'gray' })
        this.renderer.addLine('  /model <id>    Switch model', { color: 'gray' })
        this.renderer.addLine('  /models        List models', { color: 'gray' })
        this.renderer.addLine('  /memory [q]    Search memory', { color: 'gray' })
        this.renderer.addLine('  /compact       Compact context', { color: 'gray' })
        this.renderer.addLine('  /cost          Show cost', { color: 'gray' })
        this.renderer.addLine('  /exit          Exit', { color: 'gray' })
        break

      case 'clear':
        this.messages = []
        this.tokenCount = 0
        this.renderer.addLine('History cleared.', { color: 'green' })
        break

      case 'model':
        if (args) {
          const models = this.provider.listModels()
          const found = models.find(m => m.id === args || m.id.endsWith(args))
          if (found) {
            this.model = found.id
            this.renderer.addLine(`Switched to ${found.id}`, { color: 'green' })
          } else {
            this.renderer.addLine(`Model not found: ${args}`, { color: 'red' })
          }
        } else {
          this.renderer.addLine(`Current model: ${this.model}`, { color: 'yellow' })
        }
        break

      case 'models':
        for (const m of this.provider.listModels()) {
          const marker = m.id === this.model ? ' ★' : ''
          this.renderer.addLine(`  ${m.id} - ${m.name}${marker}`, { color: m.id === this.model ? 'green' : 'gray' })
        }
        break

      case 'memory':
        if (this.memoryManager) {
          if (args) {
            const results = this.memoryManager.search(args)
            if (results.length === 0) {
              this.renderer.addLine('No memories found.', { color: 'gray' })
            } else {
              for (const r of results) {
                this.renderer.addLine(`[${r.matchedLayer}] ${r.entry.title}: ${r.entry.content.slice(0, 120)}`, { color: 'gray' })
              }
            }
          } else {
            const stats = this.memoryManager.getStats()
            this.renderer.addLine(`User: ${stats.user} | Feedback: ${stats.feedback} | Project: ${stats.project} | Reference: ${stats.reference} | Total: ${stats.total}`, { color: 'gray' })
          }
        } else {
          this.renderer.addLine('Memory not configured.', { color: 'red' })
        }
        break

      case 'compact':
        if (this.compactionEngine && this.messages.length >= 4) {
          const summary = this.messages.slice(0, -2).map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 80) : '[complex]'}`).join('\n')
          const result = this.compactionEngine.compactWithSummary(this.messages, summary, 200000)
          this.renderer.addLine(`Compacted: ${result.tokensBefore} → ${result.tokensAfter} tokens (saved ${result.tokensSaved})`, { color: 'green' })
        } else {
          this.renderer.addLine('Need at least 4 messages to compact.', { color: 'yellow' })
        }
        break

      case 'cost':
        this.updateCost()
        break

      case 'exit':
        this.renderer.addLine('Goodbye!', { color: 'brightCyan' })
        this.stop()
        process.exit(0)
        break

      default:
        this.renderer.addLine(`Unknown command: /${cmd}. Type /help`, { color: 'red' })
    }
  }

  private async processMessage(input: string): Promise<void> {
    this.renderer.setStatus('Thinking...')

    const userMsg: ChatMessage = { role: 'user', content: input }
    this.messages.push(userMsg)

    try {
      const response = await this.provider.chat(this.messages, { model: this.model })

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
      }
      this.messages.push(assistantMsg)

      this.tokenCount += response.usage.inputTokens + response.usage.outputTokens
      this.requestCount++

      // Display response
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
      const lines = content.split('\n')
      for (const line of lines) {
        this.renderer.addLine(line, { color: 'white' })
      }

      this.renderer.addSeparator()
      this.renderer.setStatus(`Tokens: ${this.tokenCount.toLocaleString()} | Requests: ${this.requestCount}`)

      if (this.costTracker) {
        this.costTracker.recordUsage(this.provider as any, this.model, response.usage)
        this.updateCost()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      this.renderer.addLine(`Error: ${msg}`, { color: 'red', bold: true })
      this.renderer.setStatus('Error')
    }
  }

  private updateCost(): void {
    if (!this.costTracker) return
    const summary = this.costTracker.getSummary()
    this.renderer.setCost(`$${summary.today.toFixed(4)} today | $${summary.month.toFixed(4)} month`)
  }
}
