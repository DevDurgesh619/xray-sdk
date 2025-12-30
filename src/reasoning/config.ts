// Configuration for reasoning queue
export interface ReasoningConfig {
  concurrency: number          // Number of parallel LLM calls
  maxRetries: number           // Maximum retry attempts per job
  retryDelays: number[]        // Exponential backoff delays (ms)
  debug: boolean               // Enable verbose logging
}

export const DEFAULT_REASONING_CONFIG: ReasoningConfig = {
  concurrency: 3,
  maxRetries: 4,
  retryDelays: [1000, 2000, 4000, 8000], // 1s, 2s, 4s, 8s
  debug: false
}

export function createReasoningConfig(overrides?: Partial<ReasoningConfig>): ReasoningConfig {
  return {
    ...DEFAULT_REASONING_CONFIG,
    ...overrides
  }
}
