// MCP系统类型定义

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{ name: string; description?: string; required?: boolean }>
}

export interface MCPServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  timeout?: number
}

export interface MCPServerInfo {
  id: string
  name: string
  version: string
  status: 'connected' | 'disconnected' | 'error'
  tools: MCPTool[]
  resources: MCPResource[]
  prompts: MCPPrompt[]
}

export interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
    uri?: string
  }>
  isError?: boolean
}

export interface MCPMessage {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id?: number | string
  result?: Record<string, unknown>
  error?: { code: number; message: string; data?: unknown }
}
