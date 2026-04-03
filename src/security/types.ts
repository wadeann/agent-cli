// 安全系统类型定义

export type PermissionLevel = 'read' | 'write' | 'execute' | 'admin'

export interface ToolPermission {
  toolName: string
  level: PermissionLevel
  allowedPatterns?: string[]
  deniedPatterns?: string[]
  maxInvocationsPerMinute?: number
}

export interface SecurityConfig {
  maxInputLength: number
  maxToolOutputLength: number
  allowedCommands: string[]
  deniedPatterns: string[]
  rateLimit: {
    requestsPerMinute: number
    tokensPerMinute: number
    costPerHour: number
  }
  defaultPermissions: ToolPermission[]
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxInputLength: 100000,
  maxToolOutputLength: 1000000,
  allowedCommands: ['ls', 'cat', 'echo', 'grep', 'find', 'mkdir', 'touch', 'cp', 'mv', 'rm'],
  deniedPatterns: [
    'rm -rf /',
    'rm -rf \\*',
    '> /dev/sda',
    'mkfs',
    'chmod 777 /',
    'curl.*\\|.*sh',
    'wget.*\\|.*sh',
    'eval\\(',
    'exec\\(',
    '__import__\\(',
    'os\\.system\\(',
    'subprocess\\.',
    ';.*rm ',
    '\\|.*rm '
  ],
  rateLimit: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    costPerHour: 10
  },
  defaultPermissions: [
    { toolName: 'Read', level: 'read' },
    { toolName: 'Write', level: 'write' },
    { toolName: 'Edit', level: 'write' },
    { toolName: 'Bash', level: 'execute', maxInvocationsPerMinute: 10 },
    { toolName: 'Glob', level: 'read' },
    { toolName: 'Grep', level: 'read' }
  ]
}

export interface RateLimitState {
  requestCount: number
  tokenCount: number
  costAccumulated: number
  windowStart: number
  hourStart: number
}

export interface ValidationResult {
  valid: boolean
  reason?: string
  severity: 'info' | 'warning' | 'critical'
}
