// MCP工具适配器 - 将MCP工具转换为本地工具格式

import type { MCPTool, MCPToolCallResult } from './types.js'
import { BaseTool } from '../tools/base.js'
import type { ToolResult, ExecutionContext } from '../providers/base/types.js'
import { MCPClient } from './MCPClient.js'

export class MCPToolAdapter extends BaseTool {
  readonly name: string
  readonly description: string
  readonly category = 'execution' as const
  readonly readOnly: boolean
  readonly dangerous: boolean
  readonly inputSchema: Record<string, unknown>

  private client: MCPClient
  private mcpTool: MCPTool
  private serverId: string

  constructor(client: MCPClient, mcpTool: MCPTool, serverId: string) {
    super()
    this.client = client
    this.mcpTool = mcpTool
    this.serverId = serverId
    this.name = `mcp:${serverId}:${mcpTool.name}`
    this.description = mcpTool.description
    this.inputSchema = mcpTool.inputSchema
    this.readOnly = false
    this.dangerous = true
  }

  async execute(input: unknown, _context: ExecutionContext): Promise<ToolResult> {
    try {
      const args = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {}
      const result = await this.client.callTool(this.mcpTool.name, args)
      return this.convertResult(result)
    } catch (err: unknown) {
      return this.failure(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  private convertResult(result: MCPToolCallResult): ToolResult {
    const texts: string[] = []
    for (const content of result.content) {
      if (content.type === 'text' && content.text) {
        texts.push(content.text)
      } else if (content.type === 'image' && content.data) {
        texts.push(`[Image: ${content.mimeType ?? 'unknown'}]`)
      } else if (content.type === 'resource' && content.uri) {
        texts.push(`[Resource: ${content.uri}]`)
      }
    }

    return this.success(texts.join('\n'), {
      isError: result.isError ?? false,
      serverId: this.serverId,
      toolName: this.mcpTool.name
    })
  }

  static adaptAll(client: MCPClient, serverId: string): MCPToolAdapter[] {
    const tools = client.getTools()
    return tools.map(tool => new MCPToolAdapter(client, tool, serverId))
  }
}
