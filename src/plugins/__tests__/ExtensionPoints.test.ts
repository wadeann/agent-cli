import { describe, it, expect, beforeEach } from 'vitest'
import { ExtensionPointRegistry, PluginContextFactory } from '../ExtensionPoints.js'

describe('ExtensionPointRegistry', () => {
  let registry: ExtensionPointRegistry

  beforeEach(() => {
    registry = new ExtensionPointRegistry()
  })

  describe('createPoint', () => {
    it('creates an extension point', () => {
      const point = registry.createPoint('tools', 'tool')
      expect(point.id).toBe('tools')
      expect(point.type).toBe('tool')
    })

    it('throws on duplicate creation', () => {
      registry.createPoint('tools', 'tool')
      expect(() => registry.createPoint('tools', 'tool')).toThrow('already exists')
    })
  })

  describe('getPoint', () => {
    it('returns null for non-existent point', () => {
      expect(registry.getPoint('missing')).toBeNull()
    })

    it('returns the created point', () => {
      const point = registry.createPoint<string>('cmds', 'command')
      const retrieved = registry.getPoint<string>('cmds')
      expect(retrieved).toBe(point)
    })
  })

  describe('hasPoint', () => {
    it('returns true for existing point', () => {
      registry.createPoint('tools', 'tool')
      expect(registry.hasPoint('tools')).toBe(true)
    })

    it('returns false for non-existent point', () => {
      expect(registry.hasPoint('missing')).toBe(false)
    })
  })

  describe('removePoint', () => {
    it('removes an existing point', () => {
      registry.createPoint('tools', 'tool')
      expect(registry.removePoint('tools')).toBe(true)
      expect(registry.hasPoint('tools')).toBe(false)
    })

    it('returns false for non-existent point', () => {
      expect(registry.removePoint('missing')).toBe(false)
    })
  })

  describe('listPoints', () => {
    it('lists all point IDs', () => {
      registry.createPoint('tools', 'tool')
      registry.createPoint('cmds', 'command')
      const points = registry.listPoints()
      expect(points).toContain('tools')
      expect(points).toContain('cmds')
      expect(points).toHaveLength(2)
    })
  })

  describe('clear', () => {
    it('removes all points', () => {
      registry.createPoint('tools', 'tool')
      registry.createPoint('cmds', 'command')
      registry.clear()
      expect(registry.listPoints()).toHaveLength(0)
    })
  })
})

describe('ExtensionPoint', () => {
  let registry: ExtensionPointRegistry

  beforeEach(() => {
    registry = new ExtensionPointRegistry()
  })

  it('registers and lists extensions', () => {
    const point = registry.createPoint<{ id: string; name: string }>('tools', 'tool')
    point.register({ id: 'read', name: 'ReadTool' })
    point.register({ id: 'write', name: 'WriteTool' })
    expect(point.list()).toHaveLength(2)
    expect(point.list().map(e => e.name)).toContain('ReadTool')
  })

  it('unregisters an extension', () => {
    const point = registry.createPoint<{ id: string }>('tools', 'tool')
    point.register({ id: 't1' })
    point.register({ id: 't2' })
    point.unregister('t1')
    expect(point.list()).toHaveLength(1)
    expect(point.list()[0].id).toBe('t2')
  })

  it('auto-generates ID for extensions without id field', () => {
    const point = registry.createPoint<string>('hooks', 'hook')
    point.register('hook1')
    point.register('hook2')
    expect(point.count()).toBe(2)
  })
})

describe('PluginContextFactory', () => {
  it('creates a context with config', () => {
    const ctx = PluginContextFactory.createContext({ apiKey: 'test' })
    expect(ctx.config).toEqual({ apiKey: 'test' })
  })

  it('storage works correctly', () => {
    const ctx = PluginContextFactory.createContext()
    ctx.storage.set('key', 'value')
    expect(ctx.storage.get('key')).toBe('value')
    expect(ctx.storage.get('missing')).toBeUndefined()
    expect(ctx.storage.keys()).toContain('key')
    ctx.storage.delete('key')
    expect(ctx.storage.get('key')).toBeUndefined()
    ctx.storage.set('a', 1)
    ctx.storage.set('b', 2)
    ctx.storage.clear()
    expect(ctx.storage.keys()).toHaveLength(0)
  })

  it('events work correctly', () => {
    const ctx = PluginContextFactory.createContext()
    let received: unknown[] = []
    const handler = (...args: unknown[]) => { received = args }
    ctx.events.on('test', handler)
    ctx.events.emit('test', 'hello', 42)
    expect(received).toEqual(['hello', 42])
    ctx.events.off('test', handler)
    ctx.events.emit('test', 'should-not-receive')
    expect(received).toEqual(['hello', 42])
  })

  it('logger methods do not throw', () => {
    const ctx = PluginContextFactory.createContext()
    expect(() => ctx.logger.info('test')).not.toThrow()
    expect(() => ctx.logger.warn('test')).not.toThrow()
    expect(() => ctx.logger.error('test')).not.toThrow()
    expect(() => ctx.logger.debug('test')).not.toThrow()
  })
})
