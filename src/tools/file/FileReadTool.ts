// 文件读取工具

import { readFileSync, statSync } from 'fs'
import { resolve } from 'path'
import { BaseTool, type ToolMetadata } from '../base.js'

export interface FileReadInput {
  file_path: string
  offset?: number
  limit?: number
}

export class FileReadTool extends BaseTool {
  readonly name = 'Read'
  readonly description = 'Read the contents of a file'
  readonly category: ToolMetadata['category'] = 'file'
  readonly readOnly = true
  readonly dangerous = false
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to file to read' },
      offset: { type: 'number', description: 'Line offset to start from' },
      limit: { type: 'number', description: 'Maximum number of lines to read' }
    },
    required: ['file_path']
  }
  
  async execute(input: unknown, context: { cwd: string }): Promise<{ success: boolean; content: string; error?: string }> {
    const params = input as FileReadInput
    const filePath = resolve(context.cwd, params.file_path)
    
    try {
      const stats = statSync(filePath)
      if (!stats.isFile()) {
        return this.failure('Path is not a file')
      }
      
      // 检查文件大小 (最大10MB)
      if (stats.size > 10 * 1024 * 1024) {
        return this.failure('File too large (max 10MB)')
      }
      
      let content = readFileSync(filePath, 'utf-8')
      
      // 处理offset和limit
      const lines = content.split('\n')
      const offset = params.offset ?? 0
      const limit = params.limit ?? lines.length
      
      const selectedLines = lines.slice(offset, offset + limit)
      content = selectedLines.join('\n')
      
      const lineInfo = limit < lines.length ? ` (lines ${offset + 1}-${offset + selectedLines.length} of ${lines.length})` : ''
      
      return this.success(content + lineInfo)
    } catch (err: any) {
      if (err.code === 'ENOENT') return this.failure(`File not found: ${params.file_path}`)
      if (err.code === 'EACCES') return this.failure(`Permission denied: ${params.file_path}`)
      return this.failure(`Error reading file: ${err.message}`)
    }
  }
}
