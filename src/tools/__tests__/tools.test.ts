import { describe, it, expect, beforeEach } from 'vitest'
import { FileReadTool } from '../file/FileReadTool.js'
import { FileWriteTool } from '../file/FileWriteTool.js'
import { FileEditTool } from '../file/FileEditTool.js'
import { BashTool } from '../execution/BashTool.js'
import { GlobTool } from '../search/GlobTool.js'

describe('Tools', () => {
  const testCwd = process.cwd()
  
  describe('FileReadTool', () => {
    it('should read package.json', async () => {
      const tool = new FileReadTool()
      const result = await tool.execute({ file_path: 'package.json' }, { cwd: testCwd })
      expect(result.success).toBe(true)
      expect(result.content).toContain('"name"')
    })
    
    it('should handle missing file', async () => {
      const tool = new FileReadTool()
      const result = await tool.execute({ file_path: 'nonexistent.txt' }, { cwd: testCwd })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })
  
  describe('FileWriteTool', () => {
    it('should write file', async () => {
      const tool = new FileWriteTool()
      const result = await tool.execute(
        { file_path: '/tmp/agent-cli-test.txt', content: 'hello test' },
        { cwd: testCwd }
      )
      expect(result.success).toBe(true)
    })
    
    it('should read written file', async () => {
      const tool = new FileReadTool()
      const result = await tool.execute({ file_path: '/tmp/agent-cli-test.txt' }, { cwd: testCwd })
      expect(result.success).toBe(true)
      expect(result.content).toContain('hello test')
    })
  })
  
  describe('FileEditTool', () => {
    it('should edit file', async () => {
      const tool = new FileEditTool()
      // 先写入
      await new FileWriteTool().execute(
        { file_path: '/tmp/agent-cli-edit.txt', content: 'hello world' },
        { cwd: testCwd }
      )
      // 再编辑
      const result = await tool.execute(
        { file_path: '/tmp/agent-cli-edit.txt', old_string: 'world', new_string: 'test' },
        { cwd: testCwd }
      )
      expect(result.success).toBe(true)
      // 验证修改
      const readResult = await new FileReadTool().execute(
        { file_path: '/tmp/agent-cli-edit.txt' },
        { cwd: testCwd }
      )
      expect(readResult.content).toContain('hello test')
    })
  })
  
  describe('BashTool', () => {
    it('should execute command', async () => {
      const tool = new BashTool()
      const result = await tool.execute({ command: 'echo hello' }, { cwd: testCwd })
      expect(result.success).toBe(true)
      expect(result.content).toContain('hello')
    })
    
    it('should block dangerous commands', async () => {
      const tool = new BashTool()
      const result = await tool.execute({ command: 'rm -rf /' }, { cwd: testCwd })
      expect(result.success).toBe(false)
    })
  })
  
  describe('GlobTool', () => {
    it('should find TypeScript files', async () => {
      const tool = new GlobTool()
      const result = await tool.execute({ pattern: '**/*.ts' }, { cwd: testCwd + '/src' })
      expect(result.success).toBe(true)
      expect(result.content.length).toBeGreaterThan(0)
    })
  })
})
