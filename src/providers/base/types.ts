// 基础类型定义

export interface ModelInfo {
  id: string
  name: string
  provider: string
  contextWindow: number
  maxOutputTokens: number
  capabilities: ModelCapabilities
  pricing: Pricing
}

export interface ModelCapabilities {
  vision: boolean
  tools: boolean
  thinking: boolean
  streaming: boolean
}

export interface Pricing {
  inputPer1M: number  // per 1M tokens
  outputPer1M: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentBlock[]
  name?: string
  toolCalls?: ToolCall[]
  toolUseId?: string
}

export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result'
  text?: string
  source?: {
    type: 'base64' | 'url'
    media_type: string
    data: string
  }
  id?: string
  name?: string
  input?: unknown
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ChatOptions {
  model: string
  temperature?: number
  maxTokens?: number
  thinking?: ThinkingConfig
  topP?: number
  stopSequences?: string[]
  systemPrompt?: string
}

export interface ThinkingConfig {
  enabled: boolean
  budgetTokens?: number
}

export interface ChatChunk {
  type: 'content' | 'tool_use' | 'message_stop' | 'error'
  content?: string
  toolCalls?: ToolCall[]
  id?: string
  name?: string
  input?: unknown
  usage?: Usage
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
}

export interface ChatResponse {
  content: string
  toolCalls?: ToolCall[]
  usage: Usage
  finishReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use'
  model: string
}

export interface ProviderConfig {
  apiKey?: string
  baseUrl?: string
  organization?: string
  maxRetries?: number
  timeout?: number
  headers?: Record<string, string>
}

export interface ToolResult {
  success: boolean
  content: string
  error?: string
  metadata?: Record<string, unknown>
}

export interface ExecutionContext {
  cwd: string
  env: Record<string, string>
  sessionId: string
  userId?: string
}
