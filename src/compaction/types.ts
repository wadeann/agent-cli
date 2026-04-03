// Context compaction类型定义

import type { ChatMessage } from '../providers/base/types.js'

export interface CompactionResult {
  summary: string
  messagesKept: ChatMessage[]
  tokensBefore: number
  tokensAfter: number
  tokensSaved: number
  method: CompactionMethod
}

export type CompactionMethod = 'full' | 'partial' | 'micro' | 'prune' | 'session-memory'

export interface CompactionConfig {
  autoCompactThreshold: number
  warningBufferTokens: number
  errorBufferTokens: number
  manualCompactBufferTokens: number
  maxConsecutiveFailures: number
  reservedForSummary: number
  microCompact: {
    enabled: boolean
    idleMinutes: number
    keepRecent: number
  }
  sessionMemoryCompact: {
    enabled: boolean
    minTokens: number
    minTextBlockMessages: number
    maxTokens: number
  }
}

export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  autoCompactThreshold: 0.8,
  warningBufferTokens: 20000,
  errorBufferTokens: 20000,
  manualCompactBufferTokens: 3000,
  maxConsecutiveFailures: 3,
  reservedForSummary: 4096,
  microCompact: {
    enabled: true,
    idleMinutes: 60,
    keepRecent: 5
  },
  sessionMemoryCompact: {
    enabled: true,
    minTokens: 10000,
    minTextBlockMessages: 5,
    maxTokens: 40000
  }
}

export interface TokenEstimate {
  total: number
  byType: Record<string, number>
  messages: Array<{ index: number; tokens: number }>
}

export interface CompactionState {
  compacted: boolean
  turnCounter: number
  turnId: string
  consecutiveFailures: number
  lastCompactAt: number
  lastCompactTokens: number
}
