// 插件加载器 - 动态加载插件模块

import type { PluginV2, PluginManifest } from './types.js'

export class PluginLoader {
  private loadedModules: Map<string, PluginV2> = new Map()

  async loadFromModule(modulePath: string): Promise<PluginV2> {
    if (this.loadedModules.has(modulePath)) {
      return this.loadedModules.get(modulePath)!
    }

    const mod = await import(modulePath)
    const plugin = this.extractPlugin(mod)
    if (!plugin) {
      throw new Error(`No valid plugin export found in ${modulePath}`)
    }
    this.loadedModules.set(modulePath, plugin)
    return plugin
  }

  async loadFromObject(obj: Record<string, unknown>, modulePath = 'dynamic'): Promise<PluginV2> {
    if (this.loadedModules.has(modulePath)) {
      return this.loadedModules.get(modulePath)!
    }
    const plugin = this.extractPlugin(obj)
    if (!plugin) {
      throw new Error('Invalid plugin object')
    }
    this.loadedModules.set(modulePath, plugin)
    return plugin
  }

  validatePlugin(obj: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!obj.manifest || typeof obj.manifest !== 'object') {
      errors.push('Missing manifest')
    } else {
      const manifest = obj.manifest as Partial<PluginManifest>
      if (!manifest.id) errors.push('Missing manifest.id')
      if (!manifest.name) errors.push('Missing manifest.name')
      if (!manifest.version) errors.push('Missing manifest.version')
      if (!manifest.description) errors.push('Missing manifest.description')
    }

    if (obj.tools && !Array.isArray(obj.tools)) {
      errors.push('tools must be an array')
    }

    if (obj.commands && !Array.isArray(obj.commands)) {
      errors.push('commands must be an array')
    }

    if (obj.hooks && !Array.isArray(obj.hooks)) {
      errors.push('hooks must be an array')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private extractPlugin(mod: Record<string, unknown>): PluginV2 | null {
    if (mod.default && this.validatePlugin(mod.default as Record<string, unknown>).valid) {
      return mod.default as PluginV2
    }
    if (mod.plugin && this.validatePlugin(mod.plugin as Record<string, unknown>).valid) {
      return mod.plugin as PluginV2
    }
    if (this.validatePlugin(mod).valid) {
      return mod as unknown as PluginV2
    }
    return null
  }

  unload(modulePath: string): boolean {
    return this.loadedModules.delete(modulePath)
  }

  isLoaded(modulePath: string): boolean {
    return this.loadedModules.has(modulePath)
  }

  getLoadedModules(): string[] {
    return Array.from(this.loadedModules.keys())
  }

  clearCache(): void {
    this.loadedModules.clear()
  }
}
