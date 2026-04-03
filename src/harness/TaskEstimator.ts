// 任务复杂度估算器

import type { TaskComplexity, ResourceAllocation } from './types.js'

// 关键词权重
const COMPLEXITY_KEYWORDS: Record<string, number> = {
  // 高复杂度指标
  'architecture': 3, 'design': 3, 'refactor': 3, 'optimize': 3, 'performance': 3,
  'algorithm': 3, 'database': 3, 'api': 3, 'microservice': 4, 'distributed': 4,
  
  // 中等复杂度指标
  'feature': 2, 'component': 2, 'module': 2, 'interface': 2, 'service': 2,
  'authentication': 2, 'authorization': 2, 'validation': 2, 'testing': 2,
  
  // 基础指标
  'fix': 1, 'update': 1, 'change': 1, 'add': 1, 'remove': 1,
  
  // 特殊能力需求
  'image': 2, 'photo': 2, 'screenshot': 2, 'chart': 2, 'diagram': 2,
  'web': 1, 'http': 1, 'scrape': 3, 'csv': 2, 'excel': 2,
  'sql': 2, 'nosql': 3, 'mongo': 3, 'postgres': 3
}

const VISION_KEYWORDS = ['image', 'photo', 'picture', 'screenshot', 'chart', 'graph', 'diagram', 'visual', 'see', 'look']
const CODE_KEYWORDS = ['write', 'python', 'script', 'process', 'csv', 'data', 'code', 'function', 'class', 'method', 'variable', 'loop', 'if', 'else', 'return', 'import', 'export']
const SEARCH_KEYWORDS = ['find', 'search', 'locate', 'discover', 'identify', 'where', 'what']

export class TaskEstimator {
  /**
   * 估算任务复杂度
   */
  estimateComplexity(prompt: string): TaskComplexity {
    const lowerPrompt = prompt.toLowerCase()
    const words = lowerPrompt.split(/\s+/)
    
    // 计算复杂度分数
    let complexityScore = 0
    let visionScore = 0
    let codeScore = 0
    let searchScore = 0
    
    for (const word of words) {
      // 移除标点
      const cleanWord = word.replace(/[^\w]/g, '')
      
      if (COMPLEXITY_KEYWORDS[cleanWord]) {
        complexityScore += COMPLEXITY_KEYWORDS[cleanWord]
      }
      
      if (VISION_KEYWORDS.includes(cleanWord)) {
        visionScore += 2
      }
      
      if (CODE_KEYWORDS.includes(cleanWord)) {
        codeScore += 1
      }
      
      if (SEARCH_KEYWORDS.includes(cleanWord)) {
        searchScore += 1
      }
    }
    
    // 基础复杂度
    const baseComplexity = Math.max(1, Math.min(10, complexityScore / 2))
    
    // 估算token需求 (基于复杂度)
    const estimatedTokens = Math.min(
      8000,
      Math.max(500, baseComplexity * 800 + words.length * 10)
    )
    
    // 估算成本 (基于token和复杂度)
    // 假设平均模型价格: $3/1M input, $15/1M output
    const estimatedCost = (estimatedTokens / 1_000_000) * 9  // 加权平均
    
    // 估算步骤数
    const estimatedSteps = Math.min(
      20,
      Math.max(1, Math.floor(baseComplexity * 2))
    )
    
    // 特殊能力检测
    const requiresVision = visionScore > 0
    const requiresCodeExecution = codeScore > 2
    const requiresWebSearch = searchScore > 1 || lowerPrompt.includes('latest') || lowerPrompt.includes('current')
    
    // 置信度 (基于关键词匹配度)
    const totalKeywords = Object.keys(COMPLEXITY_KEYWORDS).length +
                         VISION_KEYWORDS.length +
                         CODE_KEYWORDS.length +
                         SEARCH_KEYWORDS.length
    const matchedKeywords = (complexityScore / 3) + visionScore + codeScore + searchScore
    const confidence = Math.min(0.95, Math.max(0.3, matchedKeywords / totalKeywords * 2))
    
    return {
      estimatedTokens,
      estimatedCost: Number(estimatedCost.toFixed(4)),
      estimatedSteps,
      requiresVision,
      requiresCodeExecution,
      requiresWebSearch,
      confidence
    }
  }
  
  /**
   * 根据复杂度推荐资源分配
   */
  recommendAllocation(complexity: TaskComplexity, availableModels: string[] = []): ResourceAllocation {
    // 根据复杂度选择模型
    let selectedModel = 'claude-sonnet-4-5-20251120'  // 默认
    
    if (complexity.estimatedTokens > 100000 || complexity.estimatedCost > 0.5) {
      selectedModel = 'claude-opus-4-5-20251120'
    } else if (complexity.estimatedTokens < 2000 && complexity.estimatedCost < 0.01) {
      selectedModel = 'claude-haiku-3-5-20250520'
    }
    
    // 如果有可用模型列表，尝试匹配
    if (availableModels.length > 0) {
      // 优先使用可用的同系列模型
      if (selectedModel.includes('opus') && availableModels.some(m => m.includes('opus'))) {
        selectedModel = availableModels.find(m => m.includes('opus')) || selectedModel
      } else if (selectedModel.includes('sonnet') && availableModels.some(m => m.includes('sonnet'))) {
        selectedModel = availableModels.find(m => m.includes('sonnet')) || selectedModel
      } else if (selectedModel.includes('haiku') && availableModels.some(m => m.includes('haiku'))) {
        selectedModel = availableModels.find(m => m.includes('haiku')) || selectedModel
      }
    }
    
    // 根据复杂度设置预算
    let maxTokens, maxCost, maxTime
    
    if (complexity.estimatedCost < 0.01) {
      maxTokens = Math.min(4000, complexity.estimatedTokens * 3)
      maxCost = Math.min(0.05, complexity.estimatedCost * 10)
      maxTime = 30000  // 30秒
    } else if (complexity.estimatedCost < 0.1) {
      maxTokens = Math.min(8000, complexity.estimatedTokens * 2)
      maxCost = Math.min(0.5, complexity.estimatedCost * 5)
      maxTime = 120000  // 2分钟
    } else {
      maxTokens = Math.min(32000, complexity.estimatedTokens * 1.5)
      maxCost = Math.min(5.0, complexity.estimatedCost * 3)
      maxTime = 300000  // 5分钟
    }
    
    // 确保不低于估算值
    maxTokens = Math.max(maxTokens, complexity.estimatedTokens)
    maxCost = Math.max(maxCost, complexity.estimatedCost * 2)  // 2倍缓冲
    
    // 设置优先级
    let priority: 'low' | 'medium' | 'high' | 'critical'
    if (complexity.estimatedCost < 0.01) priority = 'low'
    else if (complexity.estimatedCost < 0.1) priority = 'medium'
    else if (complexity.estimatedCost < 1.0) priority = 'high'
    else priority = 'critical'
    
    return {
      model: selectedModel,
      budget: {
        maxTokens,
        maxCost: Number(maxCost.toFixed(4)),
        maxTime,
        maxSteps: Math.min(50, complexity.estimatedSteps * 3)
      },
      priority,
      timeout: maxTime,
      retryPolicy: {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000
      }
    }
  }
}
