// UI状态管理器

import type { UIState, UIMessage, ToolExecutionUI, ProgressState, MessageType } from './types.js'

export class UIManager {
  private state: UIState = {
    messages: [],
    toolExecutions: [],
    progress: null,
    isStreaming: false
  }
  private listeners: Set<(state: UIState) => void> = new Set()

  getState(): UIState {
    return { ...this.state }
  }

  subscribe(listener: (state: UIState) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener({ ...this.state })
    }
  }

  addMessage(type: MessageType, content: string, metadata?: Record<string, unknown>): UIMessage {
    const msg: UIMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      content,
      timestamp: Date.now(),
      metadata
    }
    this.state.messages.push(msg)
    this.notify()
    return msg
  }

  updateLastMessage(content: string): void {
    const last = this.state.messages[this.state.messages.length - 1]
    if (last) {
      last.content = content
      this.notify()
    }
  }

  clearMessages(): void {
    this.state.messages = []
    this.notify()
  }

  addToolExecution(toolName: string, input: string): ToolExecutionUI {
    const exec: ToolExecutionUI = {
      id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      toolName,
      status: 'running',
      input,
      startedAt: Date.now()
    }
    this.state.toolExecutions.push(exec)
    this.notify()
    return exec
  }

  updateToolExecution(id: string, updates: Partial<Pick<ToolExecutionUI, 'status' | 'output'>>): void {
    const exec = this.state.toolExecutions.find(e => e.id === id)
    if (exec) {
      Object.assign(exec, updates, { completedAt: updates.status ? Date.now() : exec.completedAt })
      this.notify()
    }
  }

  clearToolExecutions(): void {
    this.state.toolExecutions = []
    this.notify()
  }

  setProgress(progress: ProgressState | null): void {
    this.state.progress = progress
    this.notify()
  }

  updateProgress(message: string, currentStep?: number, totalSteps?: number): void {
    if (!this.state.progress) return
    this.state.progress.message = message
    if (currentStep !== undefined) this.state.progress.currentStep = currentStep
    if (totalSteps !== undefined) this.state.progress.totalSteps = totalSteps
    if (this.state.progress.totalSteps > 0) {
      this.state.progress.percentage = Math.round(
        (this.state.progress.currentStep / this.state.progress.totalSteps) * 100
      )
    }
    this.notify()
  }

  setStreaming(isStreaming: boolean): void {
    this.state.isStreaming = isStreaming
    this.notify()
  }

  setCostSummary(summary: { totalCost: number; totalTokens: number; requests: number }): void {
    this.state.costSummary = summary
    this.notify()
  }

  reset(): void {
    this.state = {
      messages: [],
      toolExecutions: [],
      progress: null,
      isStreaming: false
    }
    this.notify()
  }

  getMessages(): UIMessage[] {
    return [...this.state.messages]
  }

  getToolExecutions(): ToolExecutionUI[] {
    return [...this.state.toolExecutions]
  }

  getProgress(): ProgressState | null {
    return this.state.progress ? { ...this.state.progress } : null
  }

  isStreaming(): boolean {
    return this.state.isStreaming
  }
}
