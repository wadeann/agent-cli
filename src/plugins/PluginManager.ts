// 插件管理器 - 注册、激活、停用插件

import type { PluginV2, PluginContext, PluginInfo, PluginStatus } from './types.js'

export class PluginManager {
  private plugins: Map<string, PluginV2> = new Map()
  private contexts: Map<string, PluginContext> = new Map()

  register(plugin: PluginV2): void {
    if (this.plugins.has(plugin.manifest.id)) {
      throw new Error(`Plugin ${plugin.manifest.id} already registered`)
    }
    plugin.status = 'installed'
    this.plugins.set(plugin.manifest.id, plugin)
  }

  async activate(pluginId: string, context: PluginContext): Promise<boolean> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return false
    if (plugin.status === 'activated') return true

    // Check dependencies
    if (plugin.manifest.dependencies) {
      for (const dep of plugin.manifest.dependencies) {
        const depPlugin = this.plugins.get(dep)
        if (!depPlugin || depPlugin.status !== 'activated') {
          plugin.status = 'error'
          return false
        }
      }
    }

    try {
      if (plugin.onActivate) {
        await plugin.onActivate(context)
      }
      plugin.status = 'activated'
      this.contexts.set(pluginId, context)
      return true
    } catch {
      plugin.status = 'error'
      return false
    }
  }

  async deactivate(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return false
    if (plugin.status !== 'activated') return true

    // Check if other active plugins depend on this one
    for (const [id, other] of this.plugins) {
      if (id === pluginId) continue
      if (other.status === 'activated' && other.manifest.dependencies?.includes(pluginId)) {
        return false
      }
    }

    try {
      if (plugin.onDeactivate) {
        const context = this.contexts.get(pluginId)
        if (context) await plugin.onDeactivate(context)
      }
      plugin.status = 'deactivated'
      return true
    } catch {
      plugin.status = 'error'
      return false
    }
  }

  async uninstall(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return false

    if (plugin.status === 'activated') {
      await this.deactivate(pluginId)
    }

    try {
      if (plugin.onUninstall) {
        const context = this.contexts.get(pluginId)
        if (context) await plugin.onUninstall(context)
      }
      this.plugins.delete(pluginId)
      this.contexts.delete(pluginId)
      return true
    } catch {
      return false
    }
  }

  getPlugin(pluginId: string): PluginV2 | null {
    return this.plugins.get(pluginId) ?? null
  }

  listPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
      status: p.status
    }))
  }

  listByStatus(status: PluginStatus): PluginInfo[] {
    return this.listPlugins().filter(p => p.status === status)
  }

  getAllTools(): Map<string, unknown> {
    const tools = new Map<string, unknown>()
    for (const plugin of this.plugins.values()) {
      if (plugin.status !== 'activated' || !plugin.tools) continue
      for (const tool of plugin.tools) {
        tools.set(tool.name, tool)
      }
    }
    return tools
  }

  getAllCommands(): Map<string, unknown> {
    const commands = new Map<string, unknown>()
    for (const plugin of this.plugins.values()) {
      if (plugin.status !== 'activated' || !plugin.commands) continue
      for (const cmd of plugin.commands) {
        commands.set(cmd.name, cmd)
      }
    }
    return commands
  }

  getPluginCount(): number {
    return this.plugins.size
  }

  getActivePluginCount(): number {
    return Array.from(this.plugins.values()).filter(p => p.status === 'activated').length
  }
}
