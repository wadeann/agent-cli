import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MCPServerManager } from '../MCPServerManager.js'

vi.mock('../MCPClient.js', () => {
  return {
    MCPClient: class MockMCPClient {
      private url: string
      private conn = false
      constructor(url: string) { this.url = url }
      async connect() { this.conn = true; return true }
      disconnect() { this.conn = false }
      isConnected() { return this.conn }
      getServerInfo() { return { name: 'mock-server', version: '1.0.0' } }
      getTools() { return [{ name: 'mock-tool', description: 'A mock tool', inputSchema: {} }] }
      getResources() { return [{ uri: 'file:///mock.txt', name: 'mock.txt' }] }
      getPrompts() { return [{ name: 'mock-prompt' }] }
      async callTool() { return { content: [{ type: 'text', text: 'ok' }] } }
      async readResource() { return 'content' }
      async getPrompt() { return 'prompt text' }
    }
  }
})

describe('MCPServerManager', () => {
  let manager: MCPServerManager

  beforeEach(() => {
    manager = new MCPServerManager()
  })

  describe('registerServer', () => {
    it('registers a server config', () => {
      manager.registerServer('test-server', { command: 'node', args: ['server.js'] })
      expect(manager.getServerCount()).toBe(1)
    })
  })

  describe('removeServer', () => {
    it('removes a registered server', () => {
      manager.registerServer('test', { command: 'node' })
      expect(manager.removeServer('test')).toBe(true)
      expect(manager.getServerCount()).toBe(0)
    })
  })

  describe('connectServer', () => {
    it('connects to a registered server', async () => {
      manager.registerServer('test', { command: 'node', args: ['3000'] })
      const result = await manager.connectServer('test')
      expect(result).toBe(true)
      expect(manager.getConnectedCount()).toBe(1)
    })

    it('returns false for unregistered server', async () => {
      const result = await manager.connectServer('missing')
      expect(result).toBe(false)
    })
  })

  describe('disconnectServer', () => {
    it('disconnects a connected server', async () => {
      manager.registerServer('test', { command: 'node', args: ['3000'] })
      await manager.connectServer('test')
      const result = manager.disconnectServer('test')
      expect(result).toBe(true)
      expect(manager.getConnectedCount()).toBe(0)
    })

    it('returns false for non-connected server', () => {
      expect(manager.disconnectServer('missing')).toBe(false)
    })
  })

  describe('getClient', () => {
    it('returns client for connected server', async () => {
      manager.registerServer('test', { command: 'node', args: ['3000'] })
      await manager.connectServer('test')
      const client = manager.getClient('test')
      expect(client).not.toBeNull()
    })

    it('returns null for non-connected server', () => {
      expect(manager.getClient('missing')).toBeNull()
    })
  })

  describe('getServerInfo', () => {
    it('returns server info after connection', async () => {
      manager.registerServer('test', { command: 'node', args: ['3000'] })
      await manager.connectServer('test')
      const info = manager.getServerInfo('test')
      expect(info).not.toBeNull()
      expect(info?.name).toBe('mock-server')
      expect(info?.status).toBe('connected')
    })

    it('returns null for unconnected server', () => {
      expect(manager.getServerInfo('missing')).toBeNull()
    })
  })

  describe('listServers', () => {
    it('lists all connected servers', async () => {
      manager.registerServer('s1', { command: 'node', args: ['3001'] })
      manager.registerServer('s2', { command: 'node', args: ['3002'] })
      await manager.connectServer('s1')
      await manager.connectServer('s2')
      const servers = manager.listServers()
      expect(servers).toHaveLength(2)
    })
  })

  describe('getAllTools', () => {
    it('returns tools from all connected servers', async () => {
      manager.registerServer('s1', { command: 'node', args: ['3001'] })
      manager.registerServer('s2', { command: 'node', args: ['3002'] })
      await manager.connectServer('s1')
      await manager.connectServer('s2')
      const tools = manager.getAllTools()
      expect(tools.size).toBe(2)
      expect(tools.has('s1:mock-tool')).toBe(true)
      expect(tools.has('s2:mock-tool')).toBe(true)
    })
  })

  describe('counts', () => {
    it('returns correct server count', () => {
      manager.registerServer('s1', { command: 'node' })
      manager.registerServer('s2', { command: 'node' })
      expect(manager.getServerCount()).toBe(2)
    })

    it('returns correct connected count', async () => {
      manager.registerServer('s1', { command: 'node', args: ['3001'] })
      manager.registerServer('s2', { command: 'node', args: ['3002'] })
      await manager.connectServer('s1')
      expect(manager.getConnectedCount()).toBe(1)
    })
  })
})
