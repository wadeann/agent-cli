// 插件系统类型定义

import type { Provider } from '../providers/base/Provider.js'
import type { ToolDefinition } from '../tools/base.js'

export type PluginStatus = 'installed' | 'activated' | 'deactivated' | 'error'

export interface PluginContext {
  config: Record<string, unknown>
  logger: PluginLogger
  storage: PluginStorage
  events: PluginEventEmitter
}

export interface PluginLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
  debug(message: string): void
}

export interface PluginStorage {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  delete(key: string): boolean
  clear(): void
  keys(): string[]
}

export interface PluginEventEmitter {
  on(event: string, handler: (...args: unknown[]) => void): void
  off(event: string, handler: (...args: unknown[]) => void): void
  emit(event: string, ...args: unknown[]): void
}

export interface CommandDefinition {
  name: string
  description: string
  handler: (args: string[]) => Promise<void>
}

export interface HookDefinition {
  name: string
  handler: (...args: unknown[]) => Promise<unknown>
}

export interface PromptTemplate {
  name: string
  template: string
  variables: string[]
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author?: string
  license?: string
  dependencies?: string[]
}

export interface PluginV2 {
  manifest: PluginManifest
  status: PluginStatus
  providers?: Provider[]
  tools?: ToolDefinition[]
  commands?: CommandDefinition[]
  hooks?: HookDefinition[]
  prompts?: PromptTemplate[]
  onInstall?(context: PluginContext): Promise<void>
  onUninstall?(context: PluginContext): Promise<void>
  onActivate?(context: PluginContext): Promise<void>
  onDeactivate?(context: PluginContext): Promise<void>
}

export interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  status: PluginStatus
}

export interface PluginRegistryEntry {
  id: string
  name: string
  version: string
  description: string
  downloadUrl: string
}
