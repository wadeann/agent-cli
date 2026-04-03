// 文件编辑工具

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { BaseTool, type ToolMetadata } from '../base.js'

export interface FileEditInput {
  file_path: string
  old_string: string
  new_string: string
}

export class FileEditTool extends BaseTool {
  readonly name = 'Edit'
  readonly description = 'Make a specific edit to a file'
  readonly category: ToolMetadata['category'] = 'file'
  readonly readOnly = false
  readonly dangerous = true
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to file' },
      old_string: { type: 'string', description: 'Text to replace' },
      new_string: { type: 'string', description: 'Replacement text' }
    },
    required: ['file_path', 'old_string', 'new_string']
  }
  
  async execute(input: unknown, context: { cwd: string }): Promise<{ success: boolean; content: string; error?: string }> {
    const params = input as FileEditInput
    const filePath = resolve(context.cwd, params.file_path)
    
    try {
      const content = readFileSync(filePath, 'utf-8')
      
      if (!content.includes(params.old_string)) {
        return this.failure(`Old string not found in file: ${params.old_string.substring(0, 50)}...`)
      }
      
      const newContent = content.replace(params.old_string, params.new_string)
      writeFileSync(filePath, newContent, 'utf-8')
      
      return this.success(`Edited ${params.file_path}`)
    } catch (err: any) {
      return this.failure(`Error editing file: ${err.message}`)
    }
  }
}
