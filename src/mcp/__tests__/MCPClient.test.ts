import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MCPClient } from '../MCPClient.js'

describe('MCPClient', () => {
  let client: MCPClient

  beforeEach(() => {
    vi.restoreAllMocks()
    client = new MCPClient('http://localhost:3000/mcp')
  })

  describe('constructor', () => {
    it('creates a client with server URL', () => {
      const c = new MCPClient('http://example.com/mcp')
      expect(c).toBeDefined()
    })
  })

  describe('connect', () => {
    it('connects successfully to server', async () => {
      const mockFetch = vi.fn()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            result: {
              serverInfo: { name: 'test-server', version: '1.0.0' },
              capabilities: {}
            }
          })
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: { tools: [{ name: 'read', description: 'Read file', inputSchema: {} }] } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: { resources: [] } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: { prompts: [] } })
        })

      vi.stubGlobal('fetch', mockFetch)
      const result = await client.connect()
      expect(result).toBe(true)
      expect(client.isConnected()).toBe(true)
    })

    it('returns false on connection failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
      const result = await client.connect()
      expect(result).toBe(false)
      expect(client.isConnected()).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('clears connection state', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { serverInfo: { name: 'x', version: '1.0.0' } } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { tools: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { resources: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { prompts: [] } }) })
      )
      await client.connect()
      client.disconnect()
      expect(client.isConnected()).toBe(false)
      expect(client.getTools()).toEqual([])
    })
  })

  describe('getServerInfo', () => {
    it('returns server info after connection', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { serverInfo: { name: 'my-server', version: '2.0.0' } } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { tools: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { resources: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { prompts: [] } }) })
      )
      await client.connect()
      const info = client.getServerInfo()
      expect(info.name).toBe('my-server')
      expect(info.version).toBe('2.0.0')
    })

    it('returns defaults when not connected', () => {
      const info = client.getServerInfo()
      expect(info.name).toBe('')
      expect(info.version).toBe('')
    })
  })

  describe('getTools', () => {
    it('returns tools after connection', async () => {
      const tools = [{ name: 'read', description: 'Read', inputSchema: {} }]
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { serverInfo: { name: 'x', version: '1.0.0' } } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { tools } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { resources: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { prompts: [] } }) })
      )
      await client.connect()
      const result = client.getTools()
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('read')
    })

    it('returns empty array when not connected', () => {
      expect(client.getTools()).toEqual([])
    })
  })

  describe('getResources', () => {
    it('returns resources after connection', async () => {
      const resources = [{ uri: 'file:///test.txt', name: 'test.txt' }]
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { serverInfo: { name: 'x', version: '1.0.0' } } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { tools: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { resources } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { prompts: [] } }) })
      )
      await client.connect()
      expect(client.getResources()).toHaveLength(1)
    })

    it('returns empty array when not connected', () => {
      expect(client.getResources()).toEqual([])
    })
  })

  describe('getPrompts', () => {
    it('returns prompts after connection', async () => {
      const prompts = [{ name: 'summary', description: 'Summarize code' }]
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { serverInfo: { name: 'x', version: '1.0.0' } } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { tools: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { resources: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { prompts } }) })
      )
      await client.connect()
      expect(client.getPrompts()).toHaveLength(1)
    })

    it('returns empty array when not connected', () => {
      expect(client.getPrompts()).toEqual([])
    })
  })

  describe('callTool', () => {
    it('calls a tool and returns result', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { serverInfo: { name: 'x', version: '1.0.0' } } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { tools: [{ name: 'read', description: 'Read', inputSchema: {} }] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { resources: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { prompts: [] } }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: { content: [{ type: 'text', text: 'file content' }] } })
        })
      )
      await client.connect()
      const result = await client.callTool('read', { path: '/test.txt' })
      expect(result.content).toHaveLength(1)
      expect(result.content[0].text).toBe('file content')
    })

    it('throws when not connected', async () => {
      await expect(client.callTool('read', {})).rejects.toThrow('Not connected')
    })
  })

  describe('readResource', () => {
    it('reads a resource', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { serverInfo: { name: 'x', version: '1.0.0' } } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { tools: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { resources: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { prompts: [] } }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: { contents: [{ text: 'hello world' }] } })
        })
      )
      await client.connect()
      const text = await client.readResource('file:///test.txt')
      expect(text).toBe('hello world')
    })

    it('throws when not connected', async () => {
      await expect(client.readResource('file:///x')).rejects.toThrow('Not connected')
    })
  })

  describe('getPrompt', () => {
    it('gets a prompt', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { serverInfo: { name: 'x', version: '1.0.0' } } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { tools: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { resources: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { prompts: [] } }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: { messages: [{ content: { text: 'Write a function' } }] } })
        })
      )
      await client.connect()
      const text = await client.getPrompt('code-gen')
      expect(text).toBe('Write a function')
    })

    it('throws when not connected', async () => {
      await expect(client.getPrompt('x')).rejects.toThrow('Not connected')
    })
  })
})
