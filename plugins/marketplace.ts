// Plugin Marketplace - Registry and discovery

import type { PluginRegistryEntry } from '../../src/plugins/types.js'

export const PLUGIN_MARKETPLACE: PluginRegistryEntry[] = [
  {
    id: 'code-review',
    name: 'Code Review Assistant',
    version: '1.0.0',
    description: 'Automatically reviews code changes and suggests improvements',
    downloadUrl: 'https://plugins.agent-cli.dev/code-review'
  },
  {
    id: 'git-helper',
    name: 'Git Helper',
    version: '1.0.0',
    description: 'Git operations with intelligent commit messages and branch management',
    downloadUrl: 'https://plugins.agent-cli.dev/git-helper'
  },
  {
    id: 'test-generator',
    name: 'Test Generator',
    version: '1.0.0',
    description: 'Generate unit tests for code files',
    downloadUrl: 'https://plugins.agent-cli.dev/test-generator'
  },
  {
    id: 'docker-helper',
    name: 'Docker Helper',
    version: '1.0.0',
    description: 'Dockerfile generation and container management',
    downloadUrl: 'https://plugins.agent-cli.dev/docker-helper'
  },
  {
    id: 'api-client',
    name: 'API Client',
    version: '1.0.0',
    description: 'HTTP client with OpenAPI spec integration',
    downloadUrl: 'https://plugins.agent-cli.dev/api-client'
  },
  {
    id: 'db-migrator',
    name: 'Database Migrator',
    version: '1.0.0',
    description: 'Database schema management and migration generation',
    downloadUrl: 'https://plugins.agent-cli.dev/db-migrator'
  }
]

export class PluginMarketplace {
  private registry: PluginRegistryEntry[]

  constructor(registry: PluginRegistryEntry[] = PLUGIN_MARKETPLACE) {
    this.registry = registry
  }

  search(query: string): PluginRegistryEntry[] {
    const q = query.toLowerCase()
    return this.registry.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    )
  }

  list(): PluginRegistryEntry[] {
    return [...this.registry]
  }

  getPlugin(id: string): PluginRegistryEntry | null {
    return this.registry.find(p => p.id === id) ?? null
  }

  getPluginCount(): number {
    return this.registry.length
  }
}
