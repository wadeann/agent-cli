// CLI流式输出渲染器

import { stdout } from 'process'

export class StreamRenderer {
  private buffer = ''
  private isStreaming = false
  private startTime = 0
  private tokensReceived = 0

  start(): void {
    this.isStreaming = true
    this.startTime = Date.now()
    this.buffer = ''
    this.tokensReceived = 0
    stdout.write('\n')
  }

  writeChunk(content: string): void {
    if (!this.isStreaming) return
    this.buffer += content
    this.tokensReceived++
    stdout.write(content)
  }

  stop(): { duration: number; tokens: number; content: string } {
    this.isStreaming = false
    const duration = Date.now() - this.startTime
    stdout.write('\n')
    return { duration, tokens: this.tokensReceived, content: this.buffer }
  }

  clear(): void {
    this.buffer = ''
    this.isStreaming = false
  }

  getBuffer(): string {
    return this.buffer
  }

  isStreamingActive(): boolean {
    return this.isStreaming
  }
}
