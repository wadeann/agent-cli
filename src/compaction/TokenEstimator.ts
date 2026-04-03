// Token估算器 - 估算消息的token消耗

import type { ChatMessage } from '../providers/base/types.js'
import type { TokenEstimate } from './types.js'

const AVG_CHARS_PER_TOKEN = 4
const TOOL_CALL_OVERHEAD = 50
const TOOL_RESULT_OVERHEAD = 30

export class TokenEstimator {
  estimateMessageTokens(message: ChatMessage): number {
    if (typeof message.content === 'string') {
      let tokens = Math.ceil(message.content.length / AVG_CHARS_PER_TOKEN)
      if (message.toolCalls) {
        tokens += TOOL_CALL_OVERHEAD
        for (const tc of message.toolCalls) {
          tokens += Math.ceil(JSON.stringify(tc.input).length / AVG_CHARS_PER_TOKEN)
          tokens += tc.name.length / 2
        }
      }
      return tokens
    }
    let tokens = 0
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'text' && block.text) {
          tokens += Math.ceil(block.text.length / AVG_CHARS_PER_TOKEN)
        } else if (block.type === 'image') {
          tokens += 1000
        } else if (block.type === 'tool_use' && block.input) {
          tokens += TOOL_CALL_OVERHEAD
          tokens += Math.ceil(JSON.stringify(block.input).length / AVG_CHARS_PER_TOKEN)
        } else if (block.type === 'tool_result') {
          tokens += TOOL_RESULT_OVERHEAD
          if (typeof block.input === 'string') {
            tokens += Math.ceil(block.input.length / AVG_CHARS_PER_TOKEN)
          }
        }
      }
    }
    return tokens
  }

  estimateMessages(messages: ChatMessage[]): TokenEstimate {
    let total = 0
    const byType: Record<string, number> = {}
    const messageTokens: Array<{ index: number; tokens: number }> = []

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const tokens = this.estimateMessageTokens(msg)
      total += tokens
      byType[msg.role] = (byType[msg.role] ?? 0) + tokens
      messageTokens.push({ index: i, tokens })
    }

    return { total, byType, messages: messageTokens }
  }

  estimateTextTokens(text: string): number {
    return Math.ceil(text.length / AVG_CHARS_PER_TOKEN)
  }

  getContextUsage(messages: ChatMessage[], contextWindow: number): {
    used: number
    remaining: number
    percentage: number
    isAboveThreshold: (threshold: number) => boolean
  } {
    const estimate = this.estimateMessages(messages)
    const used = estimate.total
    const remaining = Math.max(0, contextWindow - used)
    const percentage = contextWindow > 0 ? used / contextWindow : 1

    return {
      used,
      remaining,
      percentage,
      isAboveThreshold: (threshold: number) => used >= threshold
    }
  }
}
