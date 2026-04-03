// 终端输出渲染器 - 格式化输出到终端

import type { UIMessage, ToolExecutionUI, ProgressState } from './types.js'

export class TerminalRenderer {
  private width: number

  constructor(width = process.stdout.columns ?? 80, _height = process.stdout.rows ?? 24) {
    this.width = width
  }

  renderMessage(msg: UIMessage): string {
    const prefix = this.getMessagePrefix(msg.type)
    const formatted = this.wrapText(msg.content, this.width - prefix.length)
    return formatted.map((line, i) => i === 0 ? `${prefix}${line}` : `${' '.repeat(prefix.length)}${line}`).join('\n')
  }

  renderToolExecution(exec: ToolExecutionUI): string {
    const icon = this.getToolIcon(exec.status)
    const duration = exec.startedAt && exec.completedAt
      ? ` (${exec.completedAt - exec.startedAt}ms)`
      : ''
    const header = `${icon} ${exec.toolName}${duration}`
    if (exec.output) {
      return `${header}\n${this.indent(exec.output, 2)}`
    }
    return header
  }

  renderProgress(progress: ProgressState): string {
    const bar = this.renderProgressBar(progress.percentage, 30)
    return `${progress.message} ${bar} ${progress.percentage}%`
  }

  renderCostSummary(summary: { totalCost: number; totalTokens: number; requests: number }): string {
    return `Cost: $${summary.totalCost.toFixed(4)} | Tokens: ${summary.totalTokens.toLocaleString()} | Requests: ${summary.requests}`
  }

  private getMessagePrefix(type: string): string {
    switch (type) {
      case 'user': return '👤 You: '
      case 'assistant': return '🤖 Agent: '
      case 'tool': return '🔧 Tool: '
      case 'error': return '❌ Error: '
      case 'system': return '⚙️ System: '
      case 'thinking': return '💭 Thinking: '
      default: return ''
    }
  }

  private getToolIcon(status: string): string {
    switch (status) {
      case 'pending': return '⏳'
      case 'running': return '🔄'
      case 'success': return '✅'
      case 'error': return '❌'
      default: return '❓'
    }
  }

  private renderProgressBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width)
    const empty = width - filled
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = []
    const paragraphs = text.split('\n')
    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxWidth) {
        lines.push(paragraph)
      } else {
        let remaining = paragraph
        while (remaining.length > 0) {
          if (remaining.length <= maxWidth) {
            lines.push(remaining)
            break
          }
          const splitPoint = remaining.lastIndexOf(' ', maxWidth)
          if (splitPoint === -1) {
            lines.push(remaining.slice(0, maxWidth))
            remaining = remaining.slice(maxWidth)
          } else {
            lines.push(remaining.slice(0, splitPoint))
            remaining = remaining.slice(splitPoint + 1)
          }
        }
      }
    }
    return lines
  }

  private indent(text: string, spaces: number): string {
    const prefix = ' '.repeat(spaces)
    return text.split('\n').map(line => `${prefix}${line}`).join('\n')
  }

  updateDimensions(width: number, _height: number): void {
    this.width = width
  }
}
