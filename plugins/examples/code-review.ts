// Code Review Plugin - Automatically reviews code changes

import type { PluginV2, PluginContext } from '../../src/plugins/types.js'

export const codeReviewPlugin: PluginV2 = {
  manifest: {
    id: 'code-review',
    name: 'Code Review Assistant',
    version: '1.0.0',
    description: 'Automatically reviews code changes and suggests improvements',
    author: 'Agent CLI Team',
    license: 'MIT',
    dependencies: []
  },
  status: 'installed',
  tools: [
    {
      name: 'review-code',
      description: 'Review code for best practices, potential bugs, and style issues',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code to review' },
          language: { type: 'string', description: 'Programming language' }
        },
        required: ['code']
      }
    },
    {
      name: 'suggest-improvements',
      description: 'Suggest specific improvements for code quality',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code to improve' },
          focus: { type: 'string', description: 'Focus area: performance, readability, security' }
        },
        required: ['code']
      }
    }
  ],
  commands: [
    {
      name: 'review',
      description: 'Review the last code changes',
      handler: async (args: string[]) => {
        console.log('Running code review...')
      }
    }
  ],
  hooks: [
    {
      name: 'before-commit',
      handler: async (...args: unknown[]) => {
        console.log('Pre-commit code review triggered')
        return { approved: true, suggestions: [] }
      }
    }
  ],
  prompts: [
    {
      name: 'review-prompt',
      template: 'Review the following {language} code for best practices, potential bugs, and style issues:\n\n{code}',
      variables: ['language', 'code']
    }
  ],
  async onActivate(context: PluginContext) {
    context.logger.info('Code Review Assistant activated')
    context.storage.set('reviewCount', 0)
  },
  async onDeactivate(context: PluginContext) {
    const count = context.storage.get<number>('reviewCount') ?? 0
    context.logger.info(`Code Review Assistant deactivated. Total reviews: ${count}`)
  }
}
