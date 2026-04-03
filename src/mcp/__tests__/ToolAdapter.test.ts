import { describe, it, expect, vi } from 'vitest'
import { MCPToolAdapter } from '../ToolAdapter.js'

vi.mock('../MCPClient.js', () => {
  return {
    MCPClient: class MockMCPClient {
      getTools() {
        return [
          { name: 'fetch', description: 'Fetch URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } },
          { name: 'db', description: 'Query DB', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } }
        ]
      }
      async callTool(name: string, args: Record<string, unknown>) {
        if (name === 'fetch') {
          return { content: [{ type: 'text', text: `Fetched ${(args as any).url}` }] }
        }
        if (name === 'error-tool') {
          return { content: [{ type: 'text', text: 'error' }], isError: true }
        }
        return { content: [{ type: 'image', data: 'base64data', mimeType: 'image/png' }] }
      }
    }
  }
})

import { MCPClient } from '../MCPClient.js'

describe('MCPToolAdapter', () => {
  function createAdapter() {
    const client = new MCPClient('http://localhost:3000/mcp')
    const mcpTool = { name: 'fetch', description: 'Fetch URL', inputSchema: { type: 'object' } }
    return new MCPToolAdapter(client, mcpTool, 'web-server')
  }

  describe('constructor', () => {
    it('creates adapter with correct name', () => {
      const adapter = createAdapter()
      expect(adapter.name).toBe('mcp:web-server:fetch')
    })

    it('sets description from MCP tool', () => {
      const adapter = createAdapter()
      expect(adapter.description).toBe('Fetch URL')
    })

    it('sets category to execution', () => {
      const adapter = createAdapter()
      expect(adapter.category).toBe('execution')
    })

    it('marks as dangerous', () => {
      const adapter = createAdapter()
      expect(adapter.dangerous).toBe(true)
    })

    it('sets input schema from MCP tool', () => {
      const adapter = createAdapter()
      expect(adapter.inputSchema).toEqual({ type: 'object' })
    })
  })

  describe('execute', () => {
    it('executes tool and returns success result', async () => {
      const adapter = createAdapter()
      const result = await adapter.execute({ url: 'https://example.com' }, {
        cwd: '/test',
        env: {},
        sessionId: 'test-session'
      })
      expect(result.success).toBe(true)
      expect(result.content).toBe('Fetched https://example.com')
    })

    it('includes metadata in result', async () => {
      const adapter = createAdapter()
      const result = await adapter.execute({ url: 'https://example.com' }, {
        cwd: '/test',
        env: {},
        sessionId: 'test-session'
      })
      expect(result.metadata?.isError).toBe(false)
      expect(result.metadata?.serverId).toBe('web-server')
      expect(result.metadata?.toolName).toBe('fetch')
    })

    it('handles image content', async () => {
      const adapter = createAdapter()
      const client = (adapter as any).client
      vi.spyOn(client, 'callTool').mockResolvedValue({
        content: [{ type: 'image', data: 'base64', mimeType: 'image/png' }]
      })
      const result = await adapter.execute({}, { cwd: '/', env: {}, sessionId: 's' })
      expect(result.success).toBe(true)
      expect(result.content).toContain('[Image: image/png]')
    })

    it('handles resource content', async () => {
      const adapter = createAdapter()
      const client = (adapter as any).client
      vi.spyOn(client, 'callTool').mockResolvedValue({
        content: [{ type: 'resource', uri: 'file:///test.txt' }]
      })
      const result = await adapter.execute({}, { cwd: '/', env: {}, sessionId: 's' })
      expect(result.content).toContain('[Resource: file:///test.txt]')
    })

    it('handles errors gracefully', async () => {
      const adapter = createAdapter()
      const client = (adapter as any).client
      vi.spyOn(client, 'callTool').mockRejectedValue(new Error('Tool failed'))
      const result = await adapter.execute({}, { cwd: '/', env: {}, sessionId: 's' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Tool failed')
    })
  })

  describe('adaptAll', () => {
    it('creates adapters for all tools', () => {
      const client = new MCPClient('http://localhost:3000/mcp')
      const adapters = MCPToolAdapter.adaptAll(client, 'test-server')
      expect(adapters).toHaveLength(2)
      expect(adapters[0].name).toBe('mcp:test-server:fetch')
      expect(adapters[1].name).toBe('mcp:test-server:db')
    })
  })
})
