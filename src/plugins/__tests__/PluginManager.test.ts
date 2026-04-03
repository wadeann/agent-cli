import { describe, it, expect, beforeEach } from 'vitest'
import { PluginManager } from '../PluginManager.js'
import type { PluginV2, PluginContext, CommandDefinition, ToolDefinition, HookDefinition } from '../types.js'
import { PluginContextFactory } from '../ExtensionPoints.js'

function createPlugin(overrides: Partial<PluginV2> = {}): PluginV2 {
  const manifestBase = overrides.manifest ?? {}
  return {
    manifest: {
      id: manifestBase.id ?? 'test-plugin',
      name: manifestBase.name ?? 'Test Plugin',
      version: manifestBase.version ?? '1.0.0',
      description: manifestBase.description ?? 'A test plugin',
      dependencies: manifestBase.dependencies,
    },
    status: overrides.status ?? 'installed',
    tools: overrides.tools,
    commands: overrides.commands,
    hooks: overrides.hooks,
    onInstall: overrides.onInstall,
    onUninstall: overrides.onUninstall,
    onActivate: overrides.onActivate,
    onDeactivate: overrides.onDeactivate,
  }
}

function createContext(overrides: Record<string, unknown> = {}): PluginContext {
  return PluginContextFactory.createContext(overrides)
}

describe('PluginManager', () => {
  let manager: PluginManager

  beforeEach(() => {
    manager = new PluginManager()
  })

  describe('register', () => {
    it('registers a plugin', () => {
      const plugin = createPlugin()
      manager.register(plugin)
      expect(manager.getPlugin('test-plugin')).toBe(plugin)
      expect(plugin.status).toBe('installed')
    })

    it('throws on duplicate registration', () => {
      const plugin = createPlugin()
      manager.register(plugin)
      expect(() => manager.register(plugin)).toThrow('already registered')
    })
  })

  describe('activate', () => {
    it('activates a plugin', async () => {
      const plugin = createPlugin()
      manager.register(plugin)
      const ctx = createContext()
      const result = await manager.activate('test-plugin', ctx)
      expect(result).toBe(true)
      expect(plugin.status).toBe('activated')
    })

    it('returns false for non-existent plugin', async () => {
      const result = await manager.activate('missing', createContext())
      expect(result).toBe(false)
    })

    it('calls onActivate hook', async () => {
      let activated = false
      const plugin = createPlugin({
        onActivate: async () => { activated = true }
      })
      manager.register(plugin)
      await manager.activate('test-plugin', createContext())
      expect(activated).toBe(true)
    })

    it('sets status to error if activation fails', async () => {
      const plugin = createPlugin({
        onActivate: async () => { throw new Error('fail') }
      })
      manager.register(plugin)
      const result = await manager.activate('test-plugin', createContext())
      expect(result).toBe(false)
      expect(plugin.status).toBe('error')
    })

    it('checks dependencies before activation', async () => {
      const depPlugin = createPlugin({ manifest: { id: 'dep', name: 'Dep', version: '1.0.0', description: 'Dependency' } })
      const mainPlugin = createPlugin({
        manifest: { id: 'main', name: 'Main', version: '1.0.0', description: 'Main', dependencies: ['dep'] }
      })
      manager.register(depPlugin)
      manager.register(mainPlugin)
      const result = await manager.activate('main', createContext())
      expect(result).toBe(false)
      expect(mainPlugin.status).toBe('error')
    })

    it('activates when dependencies are met', async () => {
      const depPlugin = createPlugin({ manifest: { id: 'dep', name: 'Dep', version: '1.0.0', description: 'Dependency' } })
      const mainPlugin = createPlugin({
        manifest: { id: 'main', name: 'Main', version: '1.0.0', description: 'Main', dependencies: ['dep'] }
      })
      manager.register(depPlugin)
      manager.register(mainPlugin)
      await manager.activate('dep', createContext())
      const result = await manager.activate('main', createContext())
      expect(result).toBe(true)
      expect(mainPlugin.status).toBe('activated')
    })

    it('returns true if already activated', async () => {
      const plugin = createPlugin()
      manager.register(plugin)
      await manager.activate('test-plugin', createContext())
      const result = await manager.activate('test-plugin', createContext())
      expect(result).toBe(true)
    })
  })

  describe('deactivate', () => {
    it('deactivates an active plugin', async () => {
      const plugin = createPlugin()
      manager.register(plugin)
      await manager.activate('test-plugin', createContext())
      const result = await manager.deactivate('test-plugin')
      expect(result).toBe(true)
      expect(plugin.status).toBe('deactivated')
    })

    it('returns false for non-existent plugin', async () => {
      const result = await manager.deactivate('missing')
      expect(result).toBe(false)
    })

    it('calls onDeactivate hook', async () => {
      let deactivated = false
      const plugin = createPlugin({
        onDeactivate: async () => { deactivated = true }
      })
      manager.register(plugin)
      await manager.activate('test-plugin', createContext())
      await manager.deactivate('test-plugin')
      expect(deactivated).toBe(true)
    })

    it('prevents deactivation if other plugins depend on it', async () => {
      const depPlugin = createPlugin({ manifest: { id: 'dep', name: 'Dep', version: '1.0.0', description: 'Dependency' } })
      const mainPlugin = createPlugin({
        manifest: { id: 'main', name: 'Main', version: '1.0.0', description: 'Main', dependencies: ['dep'] }
      })
      manager.register(depPlugin)
      manager.register(mainPlugin)
      await manager.activate('dep', createContext())
      await manager.activate('main', createContext())
      const result = await manager.deactivate('dep')
      expect(result).toBe(false)
      expect(depPlugin.status).toBe('activated')
    })

    it('returns true if already deactivated', async () => {
      const plugin = createPlugin()
      manager.register(plugin)
      const result = await manager.deactivate('test-plugin')
      expect(result).toBe(true)
    })
  })

  describe('uninstall', () => {
    it('uninstalls a plugin', async () => {
      const plugin = createPlugin()
      manager.register(plugin)
      const result = await manager.uninstall('test-plugin')
      expect(result).toBe(true)
      expect(manager.getPlugin('test-plugin')).toBeNull()
    })

    it('deactivates before uninstalling', async () => {
      let deactivated = false
      const plugin = createPlugin({
        onDeactivate: async () => { deactivated = true }
      })
      manager.register(plugin)
      await manager.activate('test-plugin', createContext())
      await manager.uninstall('test-plugin')
      expect(deactivated).toBe(true)
    })

    it('calls onUninstall hook', async () => {
      let uninstalled = false
      const plugin = createPlugin({
        onUninstall: async () => { uninstalled = true }
      })
      manager.register(plugin)
      await manager.activate('test-plugin', createContext())
      await manager.uninstall('test-plugin')
      expect(uninstalled).toBe(true)
    })

    it('returns false for non-existent plugin', async () => {
      const result = await manager.uninstall('missing')
      expect(result).toBe(false)
    })
  })

  describe('listPlugins', () => {
    it('lists all plugins', () => {
      manager.register(createPlugin({ manifest: { id: 'p1', name: 'P1', version: '1.0.0', description: 'Plugin 1' } }))
      manager.register(createPlugin({ manifest: { id: 'p2', name: 'P2', version: '2.0.0', description: 'Plugin 2' } }))
      const list = manager.listPlugins()
      expect(list).toHaveLength(2)
      expect(list.map(p => p.id)).toContain('p1')
      expect(list.map(p => p.id)).toContain('p2')
    })

    it('filters by status', async () => {
      const p1 = createPlugin({ manifest: { id: 'p1', name: 'P1', version: '1.0.0', description: 'P1' } })
      const p2 = createPlugin({ manifest: { id: 'p2', name: 'P2', version: '1.0.0', description: 'P2' } })
      manager.register(p1)
      manager.register(p2)
      await manager.activate('p1', createContext())
      expect(manager.listByStatus('activated')).toHaveLength(1)
      expect(manager.listByStatus('installed')).toHaveLength(1)
    })
  })

  describe('getAllTools', () => {
    it('returns tools from activated plugins only', async () => {
      const tool: ToolDefinition = { name: 'test-tool', description: 'A tool', inputSchema: {} } as unknown as ToolDefinition
      const plugin = createPlugin({ tools: [tool] })
      manager.register(plugin)
      expect(manager.getAllTools().size).toBe(0)
      await manager.activate('test-plugin', createContext())
      expect(manager.getAllTools().size).toBe(1)
    })
  })

  describe('getAllCommands', () => {
    it('returns commands from activated plugins only', async () => {
      const cmd: CommandDefinition = { name: 'test-cmd', description: 'A command', handler: async () => {} }
      const plugin = createPlugin({ commands: [cmd] })
      manager.register(plugin)
      expect(manager.getAllCommands().size).toBe(0)
      await manager.activate('test-plugin', createContext())
      expect(manager.getAllCommands().size).toBe(1)
    })
  })

  describe('counts', () => {
    it('returns correct plugin count', () => {
      manager.register(createPlugin({ manifest: { id: 'p1', name: 'P1', version: '1.0.0', description: 'P1' } }))
      manager.register(createPlugin({ manifest: { id: 'p2', name: 'P2', version: '1.0.0', description: 'P2' } }))
      expect(manager.getPluginCount()).toBe(2)
    })

    it('returns correct active plugin count', async () => {
      manager.register(createPlugin({ manifest: { id: 'p1', name: 'P1', version: '1.0.0', description: 'P1' } }))
      manager.register(createPlugin({ manifest: { id: 'p2', name: 'P2', version: '1.0.0', description: 'P2' } }))
      await manager.activate('p1', createContext())
      expect(manager.getActivePluginCount()).toBe(1)
    })
  })
})
