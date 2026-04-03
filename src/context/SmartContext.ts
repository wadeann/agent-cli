// 智能上下文压缩 - 理解代码结构的压缩

import type { ChatMessage } from '../providers/base/types.js'

export interface CodeContext {
  file: string
  language: string
  symbols: string[]
  imports: string[]
  complexity: number
}

export interface ContextWindow {
  systemPrompt: string
  recentMessages: ChatMessage[]
  codeContext: CodeContext[]
  memoryContext: string
  toolResults: string[]
  totalTokens: number
}

export class SmartContextManager {
  private maxSystemTokens: number

  constructor(options: { maxSystemTokens?: number; maxCodeTokens?: number; maxMessageTokens?: number } = {}) {
    this.maxSystemTokens = options.maxSystemTokens ?? 4096
  }

  buildContext(options: {
    systemPrompt: string
    messages: ChatMessage[]
    codeContext?: CodeContext[]
    memoryContext?: string
    toolResults?: string[]
  }): ContextWindow {
    const result: ContextWindow = {
      systemPrompt: this.truncateSystemPrompt(options.systemPrompt),
      recentMessages: this.selectRelevantMessages(options.messages),
      codeContext: this.selectRelevantCode(options.codeContext ?? []),
      memoryContext: this.truncateMemoryContext(options.memoryContext ?? ''),
      toolResults: this.selectRelevantToolResults(options.toolResults ?? []),
      totalTokens: 0
    }

    result.totalTokens = this.estimateTotalTokens(result)
    return result
  }

  selectRelevantMessages(messages: ChatMessage[], maxMessages = 20): ChatMessage[] {
    // Prioritize: tool results > assistant > user > system
    const scored = messages.map((msg, i) => ({
      msg,
      index: i,
      score: this.scoreMessage(msg, i, messages.length)
    }))

    scored.sort((a, b) => b.score - a.score)
    const selected = scored.slice(0, maxMessages)
    selected.sort((a, b) => a.index - b.index)
    return selected.map(s => s.msg)
  }

  selectRelevantCode(contexts: CodeContext[], maxFiles = 5): CodeContext[] {
    return contexts
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, maxFiles)
  }

  truncateSystemPrompt(prompt: string): string {
    if (prompt.length <= this.maxSystemTokens * 4) return prompt
    return prompt.slice(0, this.maxSystemTokens * 4) + '\n...[truncated]'
  }

  truncateMemoryContext(context: string): string {
    if (context.length <= 2048) return context
    return context.slice(0, 2048) + '\n...[truncated]'
  }

  selectRelevantToolResults(results: string[], maxResults = 3): string[] {
    return results.slice(-maxResults)
  }

  private scoreMessage(msg: ChatMessage, index: number, total: number): number {
    let score = 0

    // Recency: more recent messages score higher
    const recency = index / total
    score += recency * 2

    // Tool results are highly valuable
    if (msg.role === 'tool') score += 5

    // Assistant messages with tool calls are important
    if (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.includes('tool')) {
      score += 3
    }

    // Error messages are critical
    if (typeof msg.content === 'string' && (msg.content.includes('error') || msg.content.includes('failed'))) {
      score += 4
    }

    // Long messages with rich context
    if (typeof msg.content === 'string' && msg.content.length > 200) {
      score += 1
    }

    return score
  }

  private estimateTotalTokens(ctx: ContextWindow): number {
    let total = 0
    total += ctx.systemPrompt.length / 4
    for (const msg of ctx.recentMessages) {
      total += (typeof msg.content === 'string' ? msg.content.length : JSON.stringify(msg.content).length) / 4
    }
    total += ctx.memoryContext.length / 4
    for (const result of ctx.toolResults) {
      total += result.length / 4
    }
    return Math.round(total)
  }
}
