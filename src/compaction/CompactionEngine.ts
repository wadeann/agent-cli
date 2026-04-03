// Context压缩引擎 - 管理对话历史以节省token

import type { ChatMessage } from '../providers/base/types.js'
import type { CompactionResult, CompactionConfig, CompactionState } from './types.js'
import { DEFAULT_COMPACTION_CONFIG } from './types.js'
import { TokenEstimator } from './TokenEstimator.js'

export class CompactionEngine {
  private config: CompactionConfig
  private state: CompactionState
  private estimator: TokenEstimator

  constructor(config: Partial<CompactionConfig> = {}) {
    this.config = { ...DEFAULT_COMPACTION_CONFIG, ...config }
    this.estimator = new TokenEstimator()
    this.state = {
      compacted: false,
      turnCounter: 0,
      turnId: `turn-${Date.now()}`,
      consecutiveFailures: 0,
      lastCompactAt: 0,
      lastCompactTokens: 0
    }
  }

  shouldAutoCompact(messages: ChatMessage[], contextWindow: number): boolean {
    if (this.state.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return false
    }

    const usage = this.estimator.getContextUsage(messages, contextWindow)
    const threshold = contextWindow - this.config.warningBufferTokens
    return usage.used >= threshold
  }

  shouldWarn(messages: ChatMessage[], contextWindow: number): boolean {
    const usage = this.estimator.getContextUsage(messages, contextWindow)
    const threshold = contextWindow - this.config.warningBufferTokens
    return usage.used >= threshold
  }

  shouldBlock(messages: ChatMessage[], contextWindow: number): boolean {
    const usage = this.estimator.getContextUsage(messages, contextWindow)
    const threshold = contextWindow - this.config.manualCompactBufferTokens
    return usage.used >= threshold
  }

  microCompact(messages: ChatMessage[], lastActivityAt: number): ChatMessage[] {
    if (!this.config.microCompact.enabled) return messages

    const idleMs = Date.now() - lastActivityAt
    const idleMinutes = idleMs / (60 * 1000)

    if (idleMinutes < this.config.microCompact.idleMinutes) return messages

    const compactableTools = new Set(['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'])
    let kept = 0
    const result: ChatMessage[] = []

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const isToolResult = msg.role === 'tool' || msg.role === 'user'
      const isCompactable = this.isCompactableMessage(msg, compactableTools)

      if (isToolResult && isCompactable && kept >= this.config.microCompact.keepRecent) {
        result.unshift({ ...msg, content: '[cleared]' })
      } else {
        if (isToolResult && isCompactable) kept++
        result.unshift(msg)
      }
    }

    return result
  }

  pruneHistory(messages: ChatMessage[], contextWindow: number, targetShare = 0.5): ChatMessage[] {
    const estimate = this.estimator.estimateMessages(messages)
    const targetTokens = contextWindow * targetShare

    if (estimate.total <= targetTokens) return messages

    const result = [...messages]
    let currentTokens = estimate.total
    let i = 0

    while (currentTokens > targetTokens && i < result.length) {
      const msg = result[i]
      if (this.isSafeToDrop(msg)) {
        const msgTokens = this.estimator.estimateMessageTokens(msg)
        currentTokens -= msgTokens
        result.splice(i, 1)
      } else {
        i++
      }
    }

    return result.length > 0 ? result : messages.slice(-2)
  }

  compactWithSummary(
    messages: ChatMessage[],
    summary: string,
    _contextWindow: number
  ): CompactionResult {
    const tokensBefore = this.estimator.estimateMessages(messages).total

    const systemMsg: ChatMessage = {
      role: 'system',
      content: `[Previous conversation summary]\n${summary}`
    }

    const recentCount = Math.min(4, messages.length)
    const recentMessages = messages.slice(-recentCount)

    const compactedMessages = [systemMsg, ...recentMessages]
    const estimateAfter = this.estimator.estimateMessages(compactedMessages)

    this.state.compacted = true
    this.state.turnCounter++
    this.state.consecutiveFailures = 0
    this.state.lastCompactAt = Date.now()
    this.state.lastCompactTokens = estimateAfter.total

    return {
      summary,
      messagesKept: compactedMessages,
      tokensBefore,
      tokensAfter: estimateAfter.total,
      tokensSaved: tokensBefore - estimateAfter.total,
      method: 'full'
    }
  }

  compactWithSessionMemory(
    messages: ChatMessage[],
    memoryContext: string,
    contextWindow: number
  ): CompactionResult {
    if (!this.config.sessionMemoryCompact.enabled) {
      return this.fallbackCompact(messages, contextWindow)
    }

    const tokensBefore = this.estimator.estimateMessages(messages).total
    const memoryTokens = this.estimator.estimateTextTokens(memoryContext)

    if (memoryTokens > this.config.sessionMemoryCompact.maxTokens) {
      return this.fallbackCompact(messages, contextWindow)
    }

    const recentCount = Math.min(6, messages.length)
    const recentMessages = messages.slice(-recentCount)

    const systemMsg: ChatMessage = {
      role: 'system',
      content: `[Session Memory Context]\n${memoryContext}`
    }

    const compactedMessages = [systemMsg, ...recentMessages]
    const estimateAfter = this.estimator.estimateMessages(compactedMessages)

    this.state.compacted = true
    this.state.turnCounter++
    this.state.consecutiveFailures = 0

    return {
      summary: memoryContext,
      messagesKept: compactedMessages,
      tokensBefore,
      tokensAfter: estimateAfter.total,
      tokensSaved: tokensBefore - estimateAfter.total,
      method: 'session-memory'
    }
  }

  getCompactionState(): CompactionState {
    return { ...this.state }
  }

  recordFailure(): void {
    this.state.consecutiveFailures++
  }

  private fallbackCompact(messages: ChatMessage[], contextWindow: number): CompactionResult {
    const pruned = this.pruneHistory(messages, contextWindow)
    const tokensBefore = this.estimator.estimateMessages(messages).total
    const tokensAfter = this.estimator.estimateMessages(pruned).total

    return {
      summary: '[History pruned to fit context window]',
      messagesKept: pruned,
      tokensBefore,
      tokensAfter,
      tokensSaved: tokensBefore - tokensAfter,
      method: 'prune'
    }
  }

  private isCompactableMessage(msg: ChatMessage, _tools: Set<string>): boolean {
    if (msg.role === 'tool' && msg.toolUseId) return true
    if (typeof msg.content === 'string' && msg.content.startsWith('[tool result]')) return true
    return false
  }

  private isSafeToDrop(msg: ChatMessage): boolean {
    if (msg.role === 'system') return false
    if (msg.role === 'tool') return true
    if (typeof msg.content === 'string' && msg.content.includes('[tool result]')) return true
    return false
  }
}
