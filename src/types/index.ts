// Core types for X-Ray SDK

export interface Execution {
  executionId: string
  projectId?: string
  startedAt: string
  endedAt?: string
  metadata?: Record<string, any>
  steps: Step[]
  finalOutcome?: any
}

export interface Step {
  name: string
  input?: any
  output?: any
  error?: string
  timestamp?: string
  startedAt?: string
  endedAt?: string
  durationMs?: number
  reasoning?: string
  metadata?: Record<string, any>
}

export interface ReasoningJob {
  id: string
  executionId: string
  stepName: string
  attempt: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  startedAt?: string
  completedAt?: string
  error?: string
  nextRetryAt?: string
}

export interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  totalJobs: number
}

export interface XRayConfig {
  projectId?: string
  storage?: StorageProvider
  autoReasoning?: boolean
  reasoningConfig?: ReasoningConfig
}

export interface ReasoningConfig {
  autoProcess: boolean
  concurrency: number
  maxRetries: number
  retryDelays: number[]
  debug: boolean
}

export interface StorageProvider {
  saveExecution(execution: Execution): Promise<void>
  getExecutionById(executionId: string): Promise<Execution | undefined>
  getAllExecutions(): Promise<Execution[]>
  updateStepReasoning(executionId: string, stepName: string, reasoning: string): Promise<void>
}
