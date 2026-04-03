// 文件写入工具

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { BaseTool, type ToolMetadata } from '../base.js'

export interface FileWriteInput {
  file_path: string
  content: string
  append?: boolean
}

export class FileWriteTool extends BaseTool {
  readonly name = 'Write'
  readonly description = 'Write content to a file (overwrites by default)'
  readonly category: ToolMetadata['category'] = 'file'
  readonly readOnly = false
  readonly dangerous = true
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to file to write' },
      content: { type: 'string', description: 'Content to write' },
      append: { type: 'boolean', description: 'Append instead of overwrite' }
    },
    required: ['file_path', 'content']
  }
  
  async execute(input: unknown, context: { cwd: string }): Promise<{ success: boolean; content: string; error?: string }> {
    const params = input as FileWriteInput
    const filePath = resolve(context.cwd, params.file_path)
    
    try {
      // 确保目录存在
      const dir = dirname(filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      
      const flag = params.append ? 'a' : 'w'
      writeFileSync(filePath, params.content, { flag, encoding: 'utf-8' })
      
      return this.success(`Wrote ${params.content.length} characters to ${params.file_path}`)
    } catch (err: any) {
      return this.failure(`Error writing file: ${err.message}`)
    }
  }
}
