// 成本追踪器

import type { Provider, Usage } from '../providers/base/Provider.js'

export interface CostEntry {
  timestamp: number
  model: string
  provider: string
  usage: Usage
  cost: number
  prompt: string
}

export class CostTracker {
  private entries: CostEntry[] = []
  private dailyLimit: number = 10.0  // 默认每日10美元限制
  private monthlyLimit: number = 100.0  // 默认每月100美元限制
  
  setDailyLimit(limit: number): void {
    this.dailyLimit = limit
  }
  
  setMonthlyLimit(limit: number): void {
    this.monthlyLimit = limit
  }
  
  /**
   * 记录成本
   */
  recordUsage(provider: Provider, model: string, usage: Usage, prompt: string = ''): number {
    const cost = provider.calculateCost(usage, model)
    
    const entry: CostEntry = {
      timestamp: Date.now(),
      model,
      provider: provider.providerName,
      usage,
      cost,
      prompt: prompt.substring(0, 100)  // 限制prompt长度
    }
    
    this.entries.push(entry)
    
    // 保持历史记录在合理范围内
    if (this.entries.length > 10000) {
      this.entries = this.entries.slice(-5000)
    }
    
    return cost
  }
  
  /**
   * 获取今天的成本
   */
  getTodayCost(): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.getTime()
    
    return this.entries
      .filter(e => e.timestamp >= todayStart)
      .reduce((sum, e) => sum + e.cost, 0)
  }
  
  /**
   * 获取本月的成本
   */
  getMonthCost(): number {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    
    return this.entries
      .filter(e => e.timestamp >= monthStart)
      .reduce((sum, e) => sum + e.cost, 0)
  }
  
  /**
   * 检查是否超出预算
   */
  checkBudget(): { ok: boolean; reason?: string } {
    const todayCost = this.getTodayCost()
    const monthCost = this.getMonthCost()
    
    if (todayCost >= this.dailyLimit) {
      return { ok: false, reason: `Daily limit exceeded: $${todayCost.toFixed(2)} >= $${this.dailyLimit}` }
    }
    
    if (monthCost >= this.monthlyLimit) {
      return { ok: false, reason: `Monthly limit exceeded: $${monthCost.toFixed(2)} >= $${this.monthlyLimit}` }
    }
    
    return { ok: true }
  }
  
  /**
   * 获取成本摘要
   */
  getSummary(): {
    today: number
    month: number
    dailyLimit: number
    monthlyLimit: number
    totalRequests: number
    byProvider: Record<string, number>
    byModel: Record<string, number>
  } {
    const byProvider: Record<string, number> = {}
    const byModel: Record<string, number> = {}
    
    this.entries.forEach(entry => {
      byProvider[entry.provider] = (byProvider[entry.provider] || 0) + entry.cost
      byModel[entry.model] = (byModel[entry.model] || 0) + entry.cost
    })
    
    return {
      today: this.getTodayCost(),
      month: this.getMonthCost(),
      dailyLimit: this.dailyLimit,
      monthlyLimit: this.monthlyLimit,
      totalRequests: this.entries.length,
      byProvider,
      byModel
    }
  }
  
  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.entries = []
  }
}
