// Glob搜索工具

import { glob } from 'glob'
import { resolve } from 'path'
import { BaseTool, type ToolMetadata } from '../base.js'

export interface GlobInput {
  pattern: string
  cwd?: string
  ignore?: string[]
}

export class GlobTool extends BaseTool {
  readonly name = 'Glob'
  readonly description = 'Find files by pattern'
  readonly category: ToolMetadata['category'] = 'search'
  readonly readOnly = true
  readonly dangerous = false
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.ts)' },
      cwd: { type: 'string', description: 'Working directory' },
      ignore: { type: 'array', items: { type: 'string' }, description: 'Patterns to ignore' }
    },
    required: ['pattern']
  }
  
  async execute(input: unknown, context: { cwd: string }): Promise<{ success: boolean; content: string; error?: string }> {
    const params = input as GlobInput
    const cwd = params.cwd ?? context.cwd
    
    try {
      const files = await glob(params.pattern, {
        cwd: resolve(cwd),
        ignore: params.ignore ?? ['node_modules', '.git', 'dist'],
        absolute: false
      })
      
      if (files.length === 0) {
        return this.success('No files found')
      }
      
      // 限制返回数量
      const limited = files.slice(0, 100)
      const summary = files.length > 100 ? `\n... and ${files.length - 100} more` : ''
      
      return this.success(limited.join('\n') + summary)
    } catch (err: any) {
      return this.failure(`Error searching: ${err.message}`)
    }
  }
}
