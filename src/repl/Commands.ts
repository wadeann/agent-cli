// REPL命令注册器 - 注册所有内置斜杠命令

import type { REPLSession } from './REPLSession.js'

export function registerDefaultCommands(session: REPLSession): void {
  registerHelpCommand(session)
  registerClearCommand(session)
  registerMemoryCommand(session)
  registerCompactCommand(session)
  registerCostCommand(session)
  registerModelsCommand(session)
  registerExitCommand(session)
}

function registerHelpCommand(session: REPLSession): void {
  session.registerCommand({
    name: 'help',
    description: 'Show available commands',
    handler: async () => {
      const commands = session.getCommands()
      const lines = commands.map(cmd => `  /${cmd.name.padEnd(12)} ${cmd.description}`)
      return `Available commands:\n${lines.join('\n')}`
    }
  })
}

function registerClearCommand(session: REPLSession): void {
  session.registerCommand({
    name: 'clear',
    description: 'Clear conversation history',
    handler: async () => {
      session.clearHistory()
      return 'Conversation history cleared.'
    }
  })
}

function registerMemoryCommand(session: REPLSession): void {
  session.registerCommand({
    name: 'memory',
    description: 'Search or view memory (usage: /memory <query>)',
    handler: async (args: string) => {
      const memoryManager = session.getMemoryManager()
      if (!memoryManager) return 'Memory system not configured.'

      if (args.trim()) {
        const results = memoryManager.search(args.trim())
        if (results.length === 0) return 'No matching memories found.'
        return results.map(r => `[${r.matchedLayer}] ${r.entry.title}: ${r.entry.content.slice(0, 150)}`).join('\n')
      }

      const stats = memoryManager.getStats()
      return `Memory stats:\n  User: ${stats.user}\n  Feedback: ${stats.feedback}\n  Project: ${stats.project}\n  Reference: ${stats.reference}\n  Total: ${stats.total}`
    }
  })
}

function registerCompactCommand(session: REPLSession): void {
  session.registerCommand({
    name: 'compact',
    description: 'Compact conversation context',
    handler: async () => {
      const compactionEngine = session.getCompactionEngine()
      if (!compactionEngine) return 'Compaction engine not configured.'

      const messages = session.getMessages()
      if (messages.length < 4) return 'Not enough messages to compact. Need at least 4 messages.'

      const summary = `[Conversation summary]\n${messages.slice(0, -2).map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 100) : '[complex]'}`).join('\n')}`
      const result = compactionEngine.compactWithSummary(messages, summary, 200000)

      return `Compacted: ${result.tokensBefore} -> ${result.tokensAfter} tokens (saved ${result.tokensSaved} tokens)`
    }
  })
}

function registerCostCommand(session: REPLSession): void {
  session.registerCommand({
    name: 'cost',
    description: 'Show current session cost',
    handler: async () => {
      const costTracker = session.getCostTracker()
      if (!costTracker) return 'Cost tracking not configured.'

      const summary = costTracker.getSummary()
      return `Session cost:\n  Today: $${summary.today.toFixed(4)}\n  This month: $${summary.month.toFixed(4)}\n  Requests: ${summary.totalRequests}`
    }
  })
}

function registerModelsCommand(session: REPLSession): void {
  session.registerCommand({
    name: 'models',
    description: 'List available models',
    handler: async () => {
      const provider = (session as any).provider
      if (!provider || !provider.listModels) return 'Provider not available.'
      const models = provider.listModels()
      return models.map((m: Record<string, unknown>) => `  ${m.id} (${m.name})\n    Context: ${String(m.contextWindow).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} tokens\n    Pricing: $${m.pricing}/M in, $${m.pricing}/M out`).join('\n')
    }
  })
}

function registerExitCommand(session: REPLSession): void {
  session.registerCommand({
    name: 'exit',
    description: 'Exit the REPL',
    handler: async () => {
      return '__EXIT__'
    }
  })
}
