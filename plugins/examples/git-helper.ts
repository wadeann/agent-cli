// Git Helper Plugin - Git operations and repository management

import type { PluginV2 } from '../../src/plugins/types.js'

export const gitHelperPlugin: PluginV2 = {
  manifest: {
    id: 'git-helper',
    name: 'Git Helper',
    version: '1.0.0',
    description: 'Git operations with intelligent commit messages and branch management',
    author: 'Agent CLI Team',
    license: 'MIT'
  },
  status: 'installed',
  tools: [
    {
      name: 'git-status',
      description: 'Get detailed git status with suggestions',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
    },
    {
      name: 'git-commit',
      description: 'Create intelligent commit messages based on changes',
      inputSchema: {
        type: 'object',
        properties: {
          files: { type: 'array', items: { type: 'string' } },
          type: { type: 'string', enum: ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore'] }
        }
      }
    },
    {
      name: 'git-branch',
      description: 'Create and manage branches with naming conventions',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'list', 'delete', 'switch'] },
          name: { type: 'string' }
        }
      }
    }
  ],
  commands: [
    {
      name: 'git-commit',
      description: 'Commit changes with auto-generated message',
      handler: async () => {}
    },
    {
      name: 'git-status',
      description: 'Show enhanced git status',
      handler: async () => {}
    }
  ],
  prompts: [
    {
      name: 'commit-message',
      template: 'Generate a conventional commit message for these changes:\n{changes}',
      variables: ['changes']
    }
  ]
}
