import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SubprocessManager } from '../../blocking/SubprocessManager.js'

describe('SubprocessManager', () => {
  let manager: SubprocessManager

  beforeEach(() => {
    manager = new SubprocessManager(5)
  })

  it('spawns and completes a process', async () => {
    const handle = await manager.spawn('echo', ['hello'])
    const exitCode = await handle.waitForExit()
    expect(exitCode).toBe(0)
    expect(handle.status).toBe('completed')
  })

  it('captures stdout output', async () => {
    const handle = await manager.spawn('echo', ['hello world'])
    await handle.waitForExit()
    const stdout = handle.output.filter(c => c.type === 'stdout').map(c => c.data.trim()).join('')
    expect(stdout).toContain('hello world')
  })

  it('captures stderr output', async () => {
    const handle = await manager.spawn('node', ['-e', 'console.error("error message")'])
    await handle.waitForExit()
    const stderr = handle.output.filter(c => c.type === 'stderr').map(c => c.data.trim()).join('')
    expect(stderr).toContain('error message')
  })

  it('interrupts a running process', async () => {
    const handle = await manager.spawn('sleep', ['10'])
    expect(handle.status).toBe('running')
    await handle.interrupt()
    expect(handle.status).toBe('interrupted')
    expect(handle.endTime).toBeDefined()
  })

  it('tracks active process count', async () => {
    const h1 = await manager.spawn('sleep', ['0.1'])
    expect(manager.getActiveCount()).toBe(1)
    await h1.waitForExit()
    expect(manager.getActiveCount()).toBe(0)
  })

  it('enforces max concurrent limit', async () => {
    const limitedManager = new SubprocessManager(1)
    const h1 = await limitedManager.spawn('sleep', ['5'])
    await expect(limitedManager.spawn('sleep', ['1'])).rejects.toThrow('Max concurrent')
    await h1.interrupt()
  })

  it('handles process errors', async () => {
    const handle = await manager.spawn('node', ['-e', 'process.exit(1)'])
    const exitCode = await handle.waitForExit()
    expect(exitCode).toBe(1)
    expect(handle.status).toBe('failed')
  })

  it('interrupts all processes', async () => {
    const h1 = await manager.spawn('sleep', ['10'])
    const h2 = await manager.spawn('sleep', ['10'])
    expect(manager.getActiveCount()).toBe(2)
    await manager.interruptAll()
    expect(manager.getActiveCount()).toBe(0)
  })

  it('kills all processes', async () => {
    await manager.spawn('sleep', ['10'])
    await manager.spawn('sleep', ['10'])
    manager.killAll()
    expect(manager.getActiveCount()).toBe(0)
  })

  it('gets process by pid', async () => {
    const handle = await manager.spawn('sleep', ['10'])
    const found = manager.getProcess(handle.pid)
    expect(found).not.toBeNull()
    expect(found?.pid).toBe(handle.pid)
    await handle.interrupt()
  })

  it('returns null for unknown pid', () => {
    expect(manager.getProcess(99999)).toBeNull()
  })

  it('respects timeout', async () => {
    const handle = await manager.spawn('sleep', ['10'], { timeoutMs: 100 })
    await handle.waitForExit()
    expect(handle.status).toBe('timeout')
  })

  it('limits output size', async () => {
    const largeOutput = 'x'.repeat(1000)
    const handle = await manager.spawn('echo', [largeOutput], { maxOutputBytes: 100 })
    await handle.waitForExit()
    const totalOutput = handle.output.reduce((sum, c) => sum + c.data.length, 0)
    expect(totalOutput).toBeLessThanOrEqual(100)
  })
})
