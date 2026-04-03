// 资源分配器

import type { ResourceAllocation, TaskComplexity, ResourceBudget } from './types.js'
import { TaskEstimator } from './TaskEstimator.js'

export class ResourceAllocator {
  private estimator = new TaskEstimator()
  
  /**
   * 分配资源给任务
   */
  allocate(
    prompt: string,
    userPreferences?: {
      preferredModel?: string
      maxBudget?: number
      priority?: 'low' | 'medium' | 'high' | 'critical'
    }
  ): { complexity: TaskComplexity; allocation: ResourceAllocation } {
    // 估算任务复杂度
    const complexity = this.estimator.estimateComplexity(prompt)
    
    // 应用用户偏好
    let allocation = this.estimator.recommendAllocation(complexity)
    
    if (userPreferences?.preferredModel) {
      allocation.model = userPreferences.preferredModel
    }
    
    if (userPreferences?.maxBudget) {
      allocation.budget.maxCost = Math.min(allocation.budget.maxCost, userPreferences.maxBudget)
    }
    
    if (userPreferences?.priority) {
      allocation.priority = userPreferences.priority
    }
    
    // 确保预算不为负
    allocation.budget.maxCost = Math.max(0.001, allocation.budget.maxCost)
    allocation.budget.maxTokens = Math.max(100, allocation.budget.maxTokens)
    allocation.budget.maxTime = Math.max(5000, allocation.budget.maxTime)
    
    return { complexity, allocation }
  }
  
  /**
   * 创建默认预算
   */
  createDefaultBudget(): ResourceBudget {
    return {
      maxTokens: 4000,
      maxCost: 0.10,
      maxTime: 60000,
      maxSteps: 10
    }
  }
}
