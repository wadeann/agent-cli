// MCP服务器管理器 - 管理多个MCP服务器生命周期

import type { MCPServerConfig, MCPServerInfo } from './types.js'
import { MCPClient } from './MCPClient.js'

export class MCPServerManager {
  private configs: Map<string, MCPServerConfig> = new Map()
  private clients: Map<string, MCPClient> = new Map()
  private serverInfos: Map<string, MCPServerInfo> = new Map()

  registerServer(id: string, config: MCPServerConfig): void {
    this.configs.set(id, config)
  }

  removeServer(id: string): boolean {
    this.disconnectServer(id)
    this.configs.delete(id)
    this.serverInfos.delete(id)
    return true
  }

  async connectServer(id: string): Promise<boolean> {
    const config = this.configs.get(id)
    if (!config) return false

    const client = new MCPClient(`http://localhost:${config.args?.[0] ?? '3000'}/mcp`)
    const connected = await client.connect()

    if (connected) {
      this.clients.set(id, client)
      const serverInfo = client.getServerInfo()
      this.serverInfos.set(id, {
        id,
        name: serverInfo.name,
        version: serverInfo.version,
        status: 'connected',
        tools: client.getTools(),
        resources: client.getResources(),
        prompts: client.getPrompts()
      })
    }

    return connected
  }

  disconnectServer(id: string): boolean {
    const client = this.clients.get(id)
    if (client) {
      client.disconnect()
      this.clients.delete(id)
      const info = this.serverInfos.get(id)
      if (info) info.status = 'disconnected'
      return true
    }
    return false
  }

  getClient(id: string): MCPClient | null {
    return this.clients.get(id) ?? null
  }

  getServerInfo(id: string): MCPServerInfo | null {
    return this.serverInfos.get(id) ?? null
  }

  listServers(): MCPServerInfo[] {
    return Array.from(this.serverInfos.values())
  }

  getAllTools(): Map<string, { tool: unknown; serverId: string }> {
    const allTools = new Map<string, { tool: unknown; serverId: string }>()
    for (const [id, client] of this.clients) {
      for (const tool of client.getTools()) {
        const qualifiedName = `${id}:${tool.name}`
        allTools.set(qualifiedName, { tool, serverId: id })
      }
    }
    return allTools
  }

  getServerCount(): number {
    return this.configs.size
  }

  getConnectedCount(): number {
    return Array.from(this.serverInfos.values()).filter(s => s.status === 'connected').length
  }
}
