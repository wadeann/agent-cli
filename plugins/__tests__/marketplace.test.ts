import { describe, it, expect, beforeEach } from 'vitest'
import { PluginMarketplace } from '../marketplace.js'

describe('PluginMarketplace', () => {
  let marketplace: PluginMarketplace

  beforeEach(() => {
    marketplace = new PluginMarketplace()
  })

  describe('search', () => {
    it('finds plugins by name', () => {
      const results = marketplace.search('Code Review')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('code-review')
    })

    it('finds plugins by description', () => {
      const results = marketplace.search('git')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('git-helper')
    })

    it('finds plugins by id', () => {
      const results = marketplace.search('test-generator')
      expect(results.length).toBeGreaterThan(0)
    })

    it('returns empty for no matches', () => {
      const results = marketplace.search('nonexistent-plugin-xyz')
      expect(results).toEqual([])
    })
  })

  describe('list', () => {
    it('returns all plugins', () => {
      const plugins = marketplace.list()
      expect(plugins.length).toBeGreaterThan(0)
    })

    it('returns a copy, not the original array', () => {
      const p1 = marketplace.list()
      const p2 = marketplace.list()
      expect(p1).not.toBe(p2)
    })
  })

  describe('getPlugin', () => {
    it('returns plugin by id', () => {
      const plugin = marketplace.getPlugin('code-review')
      expect(plugin).not.toBeNull()
      expect(plugin?.name).toBe('Code Review Assistant')
    })

    it('returns null for non-existent plugin', () => {
      expect(marketplace.getPlugin('nonexistent')).toBeNull()
    })
  })

  describe('getPluginCount', () => {
    it('returns correct count', () => {
      expect(marketplace.getPluginCount()).toBe(6)
    })
  })
})
