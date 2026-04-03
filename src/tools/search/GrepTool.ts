// Grep搜索工具

import { execSync } from 'child_process'
import { resolve } from 'path'
import { BaseTool, type ToolMetadata } from '../base.js'

export interface GrepInput {
  pattern: string
  path?: string
  ignore_case?: boolean
  context?: number
}

export class GrepTool extends BaseTool {
  readonly name = 'Grep'
  readonly description = 'Search for text in files'
  readonly category: ToolMetadata['category'] = 'search'
  readonly readOnly = true
  readonly dangerous = false
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Pattern to search for' },
      path: { type: 'string', description: 'Path to search in (default: .)' },
      ignore_case: { type: 'boolean', description: 'Case insensitive search' },
      context: { type: 'number', description: 'Lines of context' }
    },
    required: ['pattern']
  }
  
  async execute(input: unknown, context: { cwd: string }): Promise<{ success: boolean; content: string; error?: string }> {
    const params = input as GrepInput
    const cwd = resolve(context.cwd, params.path ?? '.')
    
    try {
      const flags = `-r ${params.ignore_case ? '-i' : ''} --line-number ${params.context ? `-C${params.context}` : ''}`
      const cmd = `rg ${flags} "${params.pattern}" . --glob '!node_modules' --glob '!.git' --json 2>/dev/null | head -50`
      
      const result = execSync(cmd, { cwd, encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 })
      
      if (!result.trim()) {
        return this.success('No matches found')
      }
      
      // 解析JSON输出
      const matches = result.split('\n')
        .filter(line => line.trim())
        .slice(0, 30)
        .map(line => {
          try {
            const data = JSON.parse(line)
            return `${data.data.line_number}: ${data.data.lines.text}`
          } catch {
            return line.substring(0, 200)
          }
        })
        .join('\n')
      
      return this.success(matches || 'No matches found')
    } catch (err: any) {
      if (err.status === 1) return this.success('No matches found')
      return this.failure(`Search error: ${err.message}`)
    }
  }
}
