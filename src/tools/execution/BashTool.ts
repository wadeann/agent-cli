// Bash执行工具

import { execSync } from 'child_process'
import { BaseTool, type ToolMetadata } from '../base.js'

export interface BashInput {
  command: string
  timeout?: number  // milliseconds
}

export class BashTool extends BaseTool {
  readonly name = 'Bash'
  readonly description = 'Execute a shell command'
  readonly category: ToolMetadata['category'] = 'execution'
  readonly readOnly = false
  readonly dangerous = true
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in ms (default: 60000)' }
    },
    required: ['command']
  }
  
  // 危险命令黑名单
  private dangerousCommands = [
    'rm -rf /',
    'mkfs',
    'dd if=/dev/zero',
    ':(){:|:&};:'
  ]
  
  async execute(input: unknown, context: { cwd: string }): Promise<{ success: boolean; content: string; error?: string }> {
    const params = input as BashInput
    
    // 检查危险命令
    for (const dangerous of this.dangerousCommands) {
      if (params.command.includes(dangerous)) {
        return this.failure(`Blocked dangerous command`)
      }
    }
    
    try {
      const timeout = params.timeout ?? 60000
      const result = execSync(params.command, {
        cwd: context.cwd,
        timeout: timeout / 1000,
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf-8'
      })
      
      return this.success(result.substring(0, 100000))
    } catch (err: any) {
      return this.failure(err.message || 'Command failed')
    }
  }
}
