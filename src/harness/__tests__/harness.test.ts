import { describe, it, expect } from 'vitest'
import { TaskEstimator } from '../TaskEstimator.js'
import { ResourceAllocator } from '../ResourceAllocator.js'

describe('Resource Management', () => {
  const estimator = new TaskEstimator()
  const allocator = new ResourceAllocator()
  
  describe('TaskEstimator', () => {
    it('should estimate simple task', () => {
      const complexity = estimator.estimateComplexity('fix typo in readme')
      expect(complexity.estimatedTokens).toBeLessThan(2000)
      expect(complexity.estimatedCost).toBeLessThan(0.05)
      expect(complexity.estimatedSteps).toBeLessThan(5)
      expect(complexity.requiresVision).toBe(false)
      expect(complexity.requiresCodeExecution).toBe(false)
    })
    
    it('should estimate complex task', () => {
      const complexity = estimator.estimateComplexity('design microservice architecture with database optimization and api gateway')
      expect(complexity.estimatedTokens).toBeGreaterThan(5000)
      expect(complexity.estimatedSteps).toBeGreaterThan(5)
    })
    
    it('should detect vision requirement', () => {
      const complexity = estimator.estimateComplexity('analyze this image and describe what you see')
      expect(complexity.requiresVision).toBe(true)
    })
    
    it('should detect code execution requirement', () => {
      const complexity = estimator.estimateComplexity('write a python script to process csv data')
      expect(complexity.requiresCodeExecution).toBe(true)
    })
    
    it('should estimate confidence', () => {
      const complexity = estimator.estimateComplexity('build a web app')
      expect(complexity.confidence).toBeGreaterThan(0)
      expect(complexity.confidence).toBeLessThanOrEqual(1)
    })
  })
  
  describe('ResourceAllocator', () => {
    it('should allocate resources for simple task', () => {
      const { complexity, allocation } = allocator.allocate('hello world')
      expect(allocation.model).toBeDefined()
      expect(allocation.budget.maxTokens).toBeGreaterThan(0)
      expect(allocation.budget.maxCost).toBeGreaterThan(0)
      expect(allocation.priority).toBeDefined()
    })
    
    it('should respect user preferences', () => {
      const { allocation } = allocator.allocate('test', { preferredModel: 'haiku' })
      expect(allocation.model).toBe('haiku')
    })
    
    it('should limit budget', () => {
      const { allocation } = allocator.allocate('complex task', { maxBudget: 0.01 })
      expect(allocation.budget.maxCost).toBeLessThanOrEqual(0.01)
    })
    
    it('should create default budget', () => {
      const budget = allocator.createDefaultBudget()
      expect(budget.maxTokens).toBe(4000)
      expect(budget.maxCost).toBe(0.10)
      expect(budget.maxTime).toBe(60000)
    })
  })
})
