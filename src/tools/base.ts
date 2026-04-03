// 工具基类定义

import type { ToolResult, ExecutionContext } from '../providers/base/types.js'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  examples?: { input: unknown; output: string }[]
}

export interface ToolMetadata {
  name: string
  description: string
  category: 'file' | 'search' | 'execution' | 'web' | 'system'
  readOnly: boolean
  dangerous: boolean
}

export abstract class BaseTool {
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly category: ToolMetadata['category']
  abstract readonly readOnly: boolean
  abstract readonly dangerous: boolean
  
  abstract inputSchema: Record<string, unknown>
  
  abstract execute(input: unknown, context: ExecutionContext): Promise<ToolResult>
  
  protected success(content: string, metadata?: Record<string, unknown>): ToolResult {
    return { success: true, content, metadata }
  }
  
  protected failure(error: string, metadata?: Record<string, unknown>): ToolResult {
    return { success: false, content: error, error, metadata }
  }
  
  validateInput(input: unknown): { valid: boolean; error?: string } {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Input must be an object' }
    }
    return { valid: true }
  }
}
