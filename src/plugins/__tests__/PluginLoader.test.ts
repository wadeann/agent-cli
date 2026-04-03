import { describe, it, expect, beforeEach } from 'vitest'
import { PluginLoader } from '../PluginLoader.js'
import type { PluginV2 } from '../types.js'

describe('PluginLoader', () => {
  let loader: PluginLoader

  beforeEach(() => {
    loader = new PluginLoader()
  })

  describe('loadFromObject', () => {
    it('loads a valid plugin object', async () => {
      const pluginObj: Record<string, unknown> = {
        manifest: { id: 'test', name: 'Test', version: '1.0.0', description: 'Test plugin' },
        status: 'installed'
      }
      const plugin = await loader.loadFromObject(pluginObj)
      expect(plugin.manifest.id).toBe('test')
    })

    it('throws on invalid plugin object', async () => {
      const invalidObj = { name: 'No manifest' }
      await expect(loader.loadFromObject(invalidObj)).rejects.toThrow('Invalid plugin object')
    })

    it('loads plugin with default export', async () => {
      const mod = {
        default: {
          manifest: { id: 'default-test', name: 'Default', version: '1.0.0', description: 'Default plugin' }
        }
      }
      const plugin = await loader.loadFromObject(mod)
      expect(plugin.manifest.id).toBe('default-test')
    })

    it('loads plugin with named export', async () => {
      const mod = {
        plugin: {
          manifest: { id: 'named-test', name: 'Named', version: '1.0.0', description: 'Named plugin' }
        }
      }
      const plugin = await loader.loadFromObject(mod)
      expect(plugin.manifest.id).toBe('named-test')
    })
  })

  describe('validatePlugin', () => {
    it('validates a correct plugin', () => {
      const obj = {
        manifest: { id: 'x', name: 'X', version: '1.0.0', description: 'X plugin' }
      }
      const result = loader.validatePlugin(obj)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects missing manifest', () => {
      const result = loader.validatePlugin({})
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing manifest')
    })

    it('detects missing manifest fields', () => {
      const obj = { manifest: {} }
      const result = loader.validatePlugin(obj)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing manifest.id')
      expect(result.errors).toContain('Missing manifest.name')
      expect(result.errors).toContain('Missing manifest.version')
      expect(result.errors).toContain('Missing manifest.description')
    })

    it('detects invalid tools type', () => {
      const obj = {
        manifest: { id: 'x', name: 'X', version: '1.0.0', description: 'X' },
        tools: 'not-an-array'
      }
      const result = loader.validatePlugin(obj)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('tools must be an array')
    })

    it('detects invalid commands type', () => {
      const obj = {
        manifest: { id: 'x', name: 'X', version: '1.0.0', description: 'X' },
        commands: 'not-an-array'
      }
      const result = loader.validatePlugin(obj)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('commands must be an array')
    })

    it('detects invalid hooks type', () => {
      const obj = {
        manifest: { id: 'x', name: 'X', version: '1.0.0', description: 'X' },
        hooks: 'not-an-array'
      }
      const result = loader.validatePlugin(obj)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('hooks must be an array')
    })
  })

  describe('unload', () => {
    it('unloads a module', async () => {
      const mod = {
        manifest: { id: 'temp', name: 'Temp', version: '1.0.0', description: 'Temp' }
      }
      await loader.loadFromObject(mod)
      expect(loader.isLoaded('temp')).toBe(false)
    })

    it('returns false for non-existent module', () => {
      expect(loader.unload('missing')).toBe(false)
    })
  })

  describe('getLoadedModules', () => {
    it('returns list of loaded modules', async () => {
      const m1 = { manifest: { id: 'a', name: 'A', version: '1.0.0', description: 'A' } }
      const m2 = { manifest: { id: 'b', name: 'B', version: '1.0.0', description: 'B' } }
      await loader.loadFromObject(m1, 'module-a')
      await loader.loadFromObject(m2, 'module-b')
      expect(loader.getLoadedModules()).toHaveLength(2)
    })
  })

  describe('clearCache', () => {
    it('clears all loaded modules', async () => {
      const m1 = { manifest: { id: 'a', name: 'A', version: '1.0.0', description: 'A' } }
      await loader.loadFromObject(m1)
      loader.clearCache()
      expect(loader.getLoadedModules()).toHaveLength(0)
    })
  })
})
