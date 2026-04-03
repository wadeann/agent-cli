// 扩展点系统 - 插件扩展核心功能

import type { PluginContext } from './types.js'

export interface ExtensionPoint<T> {
  id: string
  type: string
  register(extension: T): void
  unregister(extensionId: string): void
  list(): T[]
}

export class ExtensionPointRegistry {
  private points: Map<string, ExtensionPoint<unknown>> = new Map()

  createPoint<T>(id: string, type: string): ExtensionPoint<T> {
    if (this.points.has(id)) {
      throw new Error(`Extension point ${id} already exists`)
    }
    const point = new ExtensionPointImpl<T>(id, type)
    this.points.set(id, point as ExtensionPoint<unknown>)
    return point
  }

  getPoint<T>(id: string): ExtensionPoint<T> | null {
    return (this.points.get(id) as ExtensionPoint<T>) ?? null
  }

  hasPoint(id: string): boolean {
    return this.points.has(id)
  }

  removePoint(id: string): boolean {
    return this.points.delete(id)
  }

  listPoints(): string[] {
    return Array.from(this.points.keys())
  }

  clear(): void {
    this.points.clear()
  }
}

class ExtensionPointImpl<T> implements ExtensionPoint<T> {
  readonly id: string
  readonly type: string
  private extensions: Map<string, T> = new Map()

  constructor(id: string, type: string) {
    this.id = id
    this.type = type
  }

  register(extension: T): void {
    const extId = this.getExtensionId(extension)
    this.extensions.set(extId, extension)
  }

  unregister(extensionId: string): void {
    this.extensions.delete(extensionId)
  }

  list(): T[] {
    return Array.from(this.extensions.values())
  }

  count(): number {
    return this.extensions.size
  }

  private getExtensionId(extension: T): string {
    if (extension && typeof extension === 'object' && 'id' in extension) {
      return (extension as Record<string, unknown>).id as string
    }
    return `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}

export class PluginContextFactory {
  static createContext(config: Record<string, unknown> = {}): PluginContext {
    const storage = new Map<string, unknown>()
    const handlers = new Map<string, Set<(...args: unknown[]) => void>>()

    return {
      config,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {}
      },
      storage: {
        get: <T>(key: string) => storage.get(key) as T | undefined,
        set: <T>(key: string, value: T) => { storage.set(key, value) },
        delete: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
        keys: () => Array.from(storage.keys())
      },
      events: {
        on: (event: string, handler: (...args: unknown[]) => void) => {
          if (!handlers.has(event)) handlers.set(event, new Set())
          handlers.get(event)!.add(handler)
        },
        off: (event: string, handler: (...args: unknown[]) => void) => {
          handlers.get(event)?.delete(handler)
        },
        emit: (event: string, ...args: unknown[]) => {
          handlers.get(event)?.forEach(h => h(...args))
        }
      }
    }
  }
}
