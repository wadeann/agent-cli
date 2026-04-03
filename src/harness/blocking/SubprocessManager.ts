// 子进程流式管理器 - 非阻塞执行 + 实时输出流 + 中断支持

import { spawn } from 'child_process'
import type { SubprocessHandle, ProcessStatus, StreamChunk } from './types.js'

export class SubprocessManager {
  private processes: Map<number, SubprocessHandle> = new Map()
  private maxConcurrent: number

  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent
  }

  async spawn(command: string, args: string[], options: {
    cwd?: string
    env?: Record<string, string>
    timeoutMs?: number
    maxOutputBytes?: number
  } = {}): Promise<SubprocessHandle> {
    if (this.processes.size >= this.maxConcurrent) {
      throw new Error(`Max concurrent processes (${this.maxConcurrent}) reached`)
    }

    return new Promise((resolve, reject) => {
      const output: StreamChunk[] = []
      let totalOutput = 0
      const maxOutput = options.maxOutputBytes ?? 10 * 1024 * 1024
      let settled = false

      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let timeoutTimer: ReturnType<typeof setTimeout> | null = null
      let timedOut = false
      if (options.timeoutMs) {
        timeoutTimer = setTimeout(async () => {
          timedOut = true
          handle.status = 'timeout'
          handle.endTime = Date.now()
          await handle.interrupt()
        }, options.timeoutMs)
      }

      const handle: SubprocessHandle = {
        pid: child.pid ?? -1,
        status: 'running' as ProcessStatus,
        output,
        startTime: Date.now(),
        interrupt: async () => {
          if (child.exitCode === null && !child.killed) {
            child.kill('SIGINT')
            await new Promise<void>(r => {
              child.on('exit', () => r())
              setTimeout(r, 2000)
            })
            if (!child.killed) child.kill('SIGKILL')
            if (timeoutTimer) clearTimeout(timeoutTimer)
            if (!timedOut) {
              handle.status = 'interrupted'
            }
            handle.endTime = Date.now()
            this.processes.delete(handle.pid)
          }
        },
        waitForExit: async () => {
          return new Promise<number>((res) => {
            child.on('exit', (code) => {
              if (timeoutTimer) clearTimeout(timeoutTimer)
              handle.endTime = Date.now()
              this.processes.delete(handle.pid)
              res(code ?? 1)
            })
          })
        }
      }

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        if (totalOutput + chunk.length <= maxOutput) {
          output.push({ type: 'stdout', data: chunk, timestamp: Date.now() })
          totalOutput += chunk.length
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        if (totalOutput + chunk.length <= maxOutput) {
          output.push({ type: 'stderr', data: chunk, timestamp: Date.now() })
          totalOutput += chunk.length
        }
      })

      const handleError = (err: Error) => {
        handle.status = 'failed'
        handle.endTime = Date.now()
        output.push({ type: 'stderr', data: err.message, timestamp: Date.now() })
        this.processes.delete(handle.pid)
        if (!settled) {
          settled = true
          reject(err)
        }
      }

      child.on('error', handleError)

      child.on('exit', (code) => {
        if (handle.status === 'running') {
          handle.status = code === 0 ? 'completed' : 'failed'
        }
        handle.endTime = Date.now()
        this.processes.delete(handle.pid)
      })

      // Wait a tick to catch spawn errors (e.g. command not found)
      setTimeout(() => {
        if (!settled && handle.status === 'failed') {
          settled = true
          reject(new Error('Failed to spawn process'))
        } else if (!settled) {
          settled = true
          this.processes.set(handle.pid, handle)
          resolve(handle)
        }
      }, 10)
    })
  }

    return new Promise((resolve, reject) => {
      const output: StreamChunk[] = []
      let totalOutput = 0
      const maxOutput = options.maxOutputBytes ?? 10 * 1024 * 1024
      let settled = false

      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let timeoutTimer: ReturnType<typeof setTimeout> | null = null
      let timedOut = false
      if (options.timeoutMs) {
        timeoutTimer = setTimeout(async () => {
          timedOut = true
          handle.status = 'timeout'
          handle.endTime = Date.now()
          await handle.interrupt()
        }, options.timeoutMs)
      }

      const handle: SubprocessHandle = {
        pid: child.pid ?? -1,
        status: 'running' as ProcessStatus,
        output,
        startTime: Date.now(),
        interrupt: async () => {
          if (child.exitCode === null && !child.killed) {
            child.kill('SIGINT')
            await new Promise<void>(r => {
              child.on('exit', () => r())
              setTimeout(r, 2000)
            })
            if (!child.killed) child.kill('SIGKILL')
            if (timeoutTimer) clearTimeout(timeoutTimer)
            if (!timedOut) {
              handle.status = 'interrupted'
            }
            handle.endTime = Date.now()
            this.processes.delete(handle.pid)
          }
        },
        waitForExit: async () => {
          return new Promise<number>((res) => {
            child.on('exit', (code) => {
              if (timeoutTimer) clearTimeout(timeoutTimer)
              handle.endTime = Date.now()
              this.processes.delete(handle.pid)
              res(code ?? 1)
            })
          })
        }
      }

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        if (totalOutput + chunk.length <= maxOutput) {
          output.push({ type: 'stdout', data: chunk, timestamp: Date.now() })
          totalOutput += chunk.length
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        if (totalOutput + chunk.length <= maxOutput) {
          output.push({ type: 'stderr', data: chunk, timestamp: Date.now() })
          totalOutput += chunk.length
        }
      })

      const handleError = (err: Error) => {
        handle.status = 'failed'
        handle.endTime = Date.now()
        output.push({ type: 'stderr', data: err.message, timestamp: Date.now() })
        this.processes.delete(handle.pid)
        if (!settled) {
          settled = true
          reject(err)
        }
      }

      child.on('error', handleError)

      child.on('exit', (code) => {
        if (handle.status === 'running') {
          handle.status = code === 0 ? 'completed' : 'failed'
        }
        handle.endTime = Date.now()
        this.processes.delete(handle.pid)
      })

      // Wait a tick to catch spawn errors (e.g. command not found)
      setTimeout(() => {
        if (!settled && handle.status === 'failed') {
          settled = true
          reject(new Error('Failed to spawn process'))
        } else if (!settled) {
          settled = true
          this.processes.set(handle.pid, handle)
          resolve(handle)
        }
      }, 10)
    })
  }

    return new Promise((resolve, reject) => {
      const output: StreamChunk[] = []
      let totalOutput = 0
      const maxOutput = options.maxOutputBytes ?? 10 * 1024 * 1024
      let settled = false

      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let timeoutTimer: ReturnType<typeof setTimeout> | null = null
      let timedOut = false
      if (options.timeoutMs) {
        timeoutTimer = setTimeout(async () => {
          timedOut = true
          handle.status = 'timeout'
          handle.endTime = Date.now()
          await handle.interrupt()
        }, options.timeoutMs)
      }

      const handle: SubprocessHandle = {
        pid: child.pid ?? -1,
        status: 'running' as ProcessStatus,
        output,
        startTime: Date.now(),
        interrupt: async () => {
          if (child.exitCode === null && !child.killed) {
            child.kill('SIGINT')
            await new Promise<void>(r => {
              child.on('exit', () => r())
              setTimeout(r, 2000)
            })
            if (!child.killed) child.kill('SIGKILL')
            if (timeoutTimer) clearTimeout(timeoutTimer)
            if (!timedOut) {
              handle.status = 'interrupted'
            }
            handle.endTime = Date.now()
            this.processes.delete(handle.pid)
          }
        },
        waitForExit: async () => {
          return new Promise<number>((res) => {
            child.on('exit', (code) => {
              if (timeoutTimer) clearTimeout(timeoutTimer)
              handle.endTime = Date.now()
              this.processes.delete(handle.pid)
              res(code ?? 1)
            })
          })
        }
      }

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        if (totalOutput + chunk.length <= maxOutput) {
          output.push({ type: 'stdout', data: chunk, timestamp: Date.now() })
          totalOutput += chunk.length
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        if (totalOutput + chunk.length <= maxOutput) {
          output.push({ type: 'stderr', data: chunk, timestamp: Date.now() })
          totalOutput += chunk.length
        }
      })

      child.on('error', (err) => {
        handle.status = 'failed'
        handle.endTime = Date.now()
        output.push({ type: 'stderr', data: err.message, timestamp: Date.now() })
        this.processes.delete(handle.pid)
        if (!settled) {
          settled = true
          reject(err)
        }
      })

      child.on('exit', (code) => {
        if (handle.status === 'running') {
          handle.status = code === 0 ? 'completed' : 'failed'
        }
        handle.endTime = Date.now()
        this.processes.delete(handle.pid)
      })

      // Check if process failed to start (e.g. command not found)
      child.on('error', () => { /* handled above */ })

      // If pid is -1, the process failed to spawn
      if (child.pid === undefined || child.pid === null) {
        // Wait briefly for error event
        setTimeout(() => {
          if (!settled && handle.status === 'failed') {
            settled = true
            reject(new Error('Failed to spawn process'))
          }
        }, 100)
      }

      this.processes.set(handle.pid, handle)
      if (!settled) {
        settled = true
        resolve(handle)
      }
    })
  }

  getProcess(pid: number): SubprocessHandle | null {
    return this.processes.get(pid) ?? null
  }

  getActiveCount(): number {
    return this.processes.size
  }

  interruptAll(): Promise<void[]> {
    const promises = Array.from(this.processes.values()).map(h => h.interrupt())
    return Promise.all(promises)
  }

  killAll(): void {
    for (const handle of this.processes.values()) {
      try {
        process.kill(handle.pid, 'SIGKILL')
      } catch { /* already dead */ }
    }
    this.processes.clear()
  }
}
