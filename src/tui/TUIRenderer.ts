// TUI渲染器 - 全屏终端UI

import { stdin, stdout } from 'process'

const ESC = '\x1b'
const CSI = `${ESC}[`

export interface TUIOptions {
  title?: string
  showStatusBar?: boolean
  showCost?: boolean
  prompt?: string
}

export type TUILine = {
  text: string
  color?: string
  bold?: boolean
  dim?: boolean
  prefix?: string
}

export class TUIRenderer {
  private rows: number
  private cols: number
  private historyLines: TUILine[] = []
  private inputBuffer = ''
  private cursorPos = 0
  private inputRow: number
  private prompt: string
  private title: string
  private showStatusBar: boolean
  private showCost: boolean
  private statusText = ''
  private costText = ''
  private onInput: ((line: string) => void) | null = null
  private rawMode = false

  constructor(options: TUIOptions = {}) {
    this.rows = stdout.rows || 24
    this.cols = stdout.columns || 80
    this.prompt = options.prompt ?? '❯ '
    this.title = options.title ?? 'Agent CLI'
    this.showStatusBar = options.showStatusBar ?? true
    this.showCost = options.showCost ?? false
    this.inputRow = this.rows - (this.showStatusBar ? 2 : 1)
  }

  private color(name: string): string {
    const colors: Record<string, string> = {
      cyan: '36',
      green: '32',
      yellow: '33',
      red: '31',
      blue: '34',
      magenta: '35',
      white: '37',
      gray: '90',
      brightGreen: '92',
      brightCyan: '96'
    }
    return colors[name] ?? ''
  }

  private styled(text: string, color?: string, bold = false, dim = false): string {
    let codes: string[] = []
    if (color) codes.push(this.color(color))
    if (bold) codes.push('1')
    if (dim) codes.push('2')
    if (codes.length === 0) return text
    return `${CSI}${codes.join(';')}m${text}${CSI}0m`
  }

  private clearScreen(): void {
    process.stdout.write(`${CSI}2J${CSI}H`)
  }

  private moveCursor(row: number, col: number): void {
    process.stdout.write(`${CSI}${row};${col}H`)
  }

  private hideCursor(): void {
    process.stdout.write(`${CSI}?25l`)
  }

  private showCursor(): void {
    process.stdout.write(`${CSI}?25h`)
  }

  private drawBorder(): void {
    const line = `${CSI}90m${'─'.repeat(this.cols)}${CSI}0m`
    const titleBar = `${CSI}90m┌${'─'.repeat(this.cols - 2)}┐${CSI}0m`
    const titleText = ` ${this.styled(this.title, 'brightCyan', true)} `
    const padding = this.cols - 2 - titleText.replace(/\x1b\[[0-9;]*m/g, '').length
    const titleLine = `${CSI}90m│${CSI}0m${titleText}${' '.repeat(Math.max(0, padding))}${CSI}90m│${CSI}0m`

    process.stdout.write(titleBar + '\n')
    process.stdout.write(titleLine + '\n')
    process.stdout.write(line + '\n')
  }

  private drawHistory(): void {
    const historyArea = this.inputRow - 3
    const visibleLines = this.historyLines.slice(-historyArea)

    for (let i = 0; i < historyArea; i++) {
      const line = visibleLines[i - (historyArea - visibleLines.length)]
      if (line) {
        const text = this.styled(line.text, line.color, line.bold, line.dim)
        const prefix = line.prefix ? this.styled(line.prefix, 'cyan') : '  '
        process.stdout.write(`${prefix}${text}\n`)
      } else {
        process.stdout.write('\n')
      }
    }
  }

  private drawInput(): void {
    const promptText = this.styled(this.prompt, 'green', true)
    const display = this.inputBuffer
    process.stdout.write(`${promptText}${display}${CSI}0m`)
  }

  private drawStatusBar(): void {
    if (!this.showStatusBar) return
    const line = `${CSI}90m${'─'.repeat(this.cols)}${CSI}0m`
    const status = this.styled(this.statusText || 'Ready', 'gray')
    const cost = this.showCost && this.costText ? `  ${this.styled(this.costText, 'yellow')}` : ''
    const help = this.styled('Ctrl+C: quit  /help: commands', 'gray', false, true)
    const bar = `${status}${cost}  ${help}`
    const padded = bar + ' '.repeat(Math.max(0, this.cols - bar.replace(/\x1b\[[0-9;]*m/g, '').length))
    process.stdout.write(`${line}\n${padded.slice(0, this.cols)}\n`)
  }

  render(): void {
    this.clearScreen()
    this.hideCursor()
    this.drawBorder()
    this.drawHistory()
    this.drawInput()
    this.drawStatusBar()
    this.moveCursor(this.inputRow + 1, this.prompt.length + 1)
    this.showCursor()
  }

  addLine(text: string, options: { color?: string; bold?: boolean; dim?: boolean; prefix?: string } = {}): void {
    this.historyLines.push({ text, ...options })
    this.render()
  }

  addSeparator(): void {
    this.historyLines.push({ text: '─'.repeat(this.cols - 4), color: 'gray', dim: true })
    this.render()
  }

  setStatus(text: string): void {
    this.statusText = text
    this.render()
  }

  setCost(text: string): void {
    this.costText = text
    this.render()
  }

  setInput(text: string): void {
    this.inputBuffer = text
    this.cursorPos = text.length
    this.render()
  }

  setRawMode(enabled: boolean): void {
    if (enabled && !this.rawMode) {
      (stdin as any).setRawMode(true)
      this.rawMode = true
    } else if (!enabled && this.rawMode) {
      (stdin as any).setRawMode(false)
      this.rawMode = false
    }
  }

  start(onInput: (line: string) => void): void {
    this.onInput = onInput
    this.setRawMode(true)
    this.render()

    stdin.on('data', this.handleKey.bind(this))
  }

  stop(): void {
    this.setRawMode(false)
    this.showCursor()
    process.stdout.write('\n')
    stdin.removeAllListeners('data')
  }

  private handleKey(chunk: Buffer): void {
    const key = chunk.toString()

    if (key === '\u0003') {
      this.stop()
      process.exit(0)
      return
    }

    if (key === '\r' || key === '\n') {
      const line = this.inputBuffer.trim()
      if (line) {
        this.addLine(this.prompt + line, { color: 'green', bold: true })
        this.inputBuffer = ''
        this.cursorPos = 0
        if (this.onInput) this.onInput(line)
      }
      return
    }

    if (key === '\u007f' || key === '\x7f') {
      if (this.cursorPos > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, -1)
        this.cursorPos--
        this.render()
      }
      return
    }

    if (key === '\u001b') return

    if (key.length === 1 && key >= ' ') {
      this.inputBuffer += key
      this.cursorPos++
      this.render()
    }
  }

  resize(): void {
    this.rows = stdout.rows || 24
    this.cols = stdout.columns || 80
    this.inputRow = this.rows - (this.showStatusBar ? 2 : 1)
    this.render()
  }
}
