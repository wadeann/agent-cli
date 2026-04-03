// MCP客户端 - 与MCP服务器通信

import type { MCPTool, MCPResource, MCPPrompt, MCPToolCallResult, MCPMessage } from './types.js'

export class MCPClient {
  private serverUrl: string
  private requestId = 0
  private connected = false
  private serverName = ''
  private serverVersion = ''
  private tools: MCPTool[] = []
  private resources: MCPResource[] = []
  private prompts: MCPPrompt[] = []

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl
  }

  async connect(): Promise<boolean> {
    try {
      const initResult = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        clientInfo: {
          name: 'agent-cli',
          version: '0.1.0'
        }
      }) as { serverInfo?: { name: string; version: string } }

      this.serverName = initResult.serverInfo?.name ?? 'unknown'
      this.serverVersion = initResult.serverInfo?.version ?? '0.0.0'

      await this.sendNotification('notifications/initialized', {})

      const toolsResult = await this.sendRequest('tools/list', {})
      this.tools = (toolsResult.tools as MCPTool[]) ?? []

      const resourcesResult = await this.sendRequest('resources/list', {})
      this.resources = (resourcesResult.resources as MCPResource[]) ?? []

      const promptsResult = await this.sendRequest('prompts/list', {})
      this.prompts = (promptsResult.prompts as MCPPrompt[]) ?? []

      this.connected = true
      return true
    } catch {
      this.connected = false
      return false
    }
  }

  disconnect(): void {
    this.connected = false
    this.tools = []
    this.resources = []
    this.prompts = []
  }

  isConnected(): boolean {
    return this.connected
  }

  getServerInfo(): { name: string; version: string } {
    return { name: this.serverName, version: this.serverVersion }
  }

  getTools(): MCPTool[] {
    return this.connected ? [...this.tools] : []
  }

  getResources(): MCPResource[] {
    return this.connected ? [...this.resources] : []
  }

  getPrompts(): MCPPrompt[] {
    return this.connected ? [...this.prompts] : []
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (!this.connected) throw new Error('Not connected to MCP server')
    const result = await this.sendRequest('tools/call', { name, arguments: args })
    return {
      content: (result.content as MCPToolCallResult['content']) ?? [],
      isError: result.isError as boolean | undefined
    }
  }

  async readResource(uri: string): Promise<string> {
    if (!this.connected) throw new Error('Not connected to MCP server')
    const result = await this.sendRequest('resources/read', { uri }) as { contents?: Array<{ text?: string }> }
    return result.contents?.[0]?.text ?? ''
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<string> {
    if (!this.connected) throw new Error('Not connected to MCP server')
    const result = await this.sendRequest('prompts/get', { name, arguments: args }) as { messages?: Array<{ content?: { text?: string } }> }
    return result.messages?.[0]?.content?.text ?? ''
  }

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.requestId++
    const message: MCPMessage = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId
    }

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json() as MCPMessage
    if (data.error) {
      throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`)
    }
    return (data.result ?? {}) as Record<string, unknown>
  }

  private async sendNotification(method: string, params: Record<string, unknown>): Promise<void> {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      method,
      params
    }
    await fetch(this.serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
  }
}
