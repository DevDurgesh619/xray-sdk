// Database-backed queue for asynchronous reasoning generation
import PQueue from 'p-queue'
import { ReasoningConfig, DEFAULT_REASONING_CONFIG } from './config'
import { ReasoningGenerator } from './generator'
import { ReasoningJob, QueueStats, StorageProvider } from '../types'
import { randomUUID } from 'crypto'

export class ReasoningQueue {
  private jobs: Map<string, ReasoningJob>
  private queue: PQueue
  private config: ReasoningConfig
  private storage: StorageProvider
  private generator: ReasoningGenerator
  private prisma?: any

  constructor(
    storage: StorageProvider,
    generator: ReasoningGenerator,
    config: Partial<ReasoningConfig> = {},
    prismaClient?: any
  ) {
    this.config = { ...DEFAULT_REASONING_CONFIG, ...config }
    this.storage = storage
    this.generator = generator
    this.prisma = prismaClient
    this.jobs = new Map()
    this.queue = new PQueue({ concurrency: this.config.concurrency })

    if (this.config.debug) {
      console.log('[XRay Queue] Reasoning queue initialized', {
        concurrency: this.config.concurrency,
        maxRetries: this.config.maxRetries
      })
    }

    // Load pending jobs from database if available
    if (this.prisma) {
      this.loadPendingJobs().catch(error => {
        console.error('[XRay Queue] Failed to load pending jobs from database:', error)
      })
    }
  }

  /**
   * Load pending jobs from database (for recovery after restart)
   */
  private async loadPendingJobs(): Promise<void> {
    if (!this.prisma) return

    try {
      const pendingJobs = await this.prisma.reasoningJob.findMany({
        where: {
          status: { in: ['pending', 'processing'] }
        }
      })

      if (pendingJobs.length > 0) {
        console.log(`[XRay Queue] Found ${pendingJobs.length} pending jobs in database, re-enqueuing...`)

        for (const dbJob of pendingJobs) {
          const job: ReasoningJob = {
            id: dbJob.id,
            executionId: dbJob.executionId,
            stepName: dbJob.stepName,
            attempt: dbJob.attempts,
            status: 'pending',
            createdAt: dbJob.createdAt.toISOString()
          }

          this.jobs.set(job.id, job)
          this.queue.add(() => this.processJob(job.id))
        }

        console.log(`[XRay Queue] Re-enqueued ${pendingJobs.length} jobs from database`)
      }
    } catch (error) {
      console.error('[XRay Queue] Failed to load pending jobs from database:', error)
    }
  }

  /**
   * Enqueue a single step for reasoning generation
   */
  async enqueue(executionId: string, stepName: string): Promise<string> {
    const jobId = randomUUID()

    const job: ReasoningJob = {
      id: jobId,
      executionId,
      stepName,
      attempt: 1,
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    this.jobs.set(jobId, job)

    // Persist job to database if Prisma client is available
    if (this.prisma) {
      try {
        const execution = await this.prisma.execution.findUnique({
          where: { executionId },
          select: { id: true }
        })

        if (execution) {
          await this.prisma.reasoningJob.create({
            data: {
              id: jobId,
              executionId: execution.id,
              stepName,
              status: 'pending',
              attempts: 1
            }
          })
        }
      } catch (error) {
        console.error(`[XRay Queue] Failed to persist job to database:`, error)
      }
    }

    // Add to queue
    this.queue.add(() => this.processJob(jobId))

    if (this.config.debug) {
      console.log(`[XRay Queue] Job enqueued: ${executionId}/${stepName}`)
    }

    return jobId
  }

  /**
   * Enqueue all steps from an execution that don't have reasoning
   */
  async enqueueExecution(executionId: string): Promise<string[]> {
    const execution = await this.storage.getExecutionById(executionId)
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`)
    }

    const jobIds: string[] = []

    for (const step of execution.steps) {
      if (!step.reasoning) {
        const jobId = await this.enqueue(executionId, step.name)
        jobIds.push(jobId)
      }
    }

    return jobIds
  }

  /**
   * Process a single job with retry logic
   */
  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) {
      console.error(`[XRay Queue] Job ${jobId} not found`)
      return
    }

    job.status = 'processing'
    job.startedAt = new Date().toISOString()

    // Update job status in database
    if (this.prisma) {
      try {
        await this.prisma.reasoningJob.update({
          where: { id: jobId },
          data: { status: 'processing' }
        })
      } catch (error) {
        console.error(`[XRay Queue] Failed to update job status in database:`, error)
      }
    }

    if (this.config.debug) {
      console.log(`[XRay Queue] Processing job ${jobId} (attempt ${job.attempt}/${this.config.maxRetries})`)
    }

    try {
      // Load execution
      const execution = await this.storage.getExecutionById(job.executionId)
      if (!execution) {
        throw new Error(`Execution ${job.executionId} not found`)
      }

      // Find the step
      const step = execution.steps.find(s => s.name === job.stepName)
      if (!step) {
        throw new Error(`Step ${job.stepName} not found in execution ${job.executionId}`)
      }

      // Skip if reasoning already exists
      if (step.reasoning) {
        console.log(`[XRay Queue] Reasoning already exists for ${job.stepName}, skipping`)
        job.status = 'completed'
        job.completedAt = new Date().toISOString()
        return
      }

      // Generate reasoning
      const reasoning = await this.generator(step)

      // Update storage
      await this.storage.updateStepReasoning(job.executionId, job.stepName, reasoning)

      // Mark job as completed
      job.status = 'completed'
      job.completedAt = new Date().toISOString()

      // Update job in database
      if (this.prisma) {
        try {
          await this.prisma.reasoningJob.update({
            where: { id: jobId },
            data: {
              status: 'completed',
              reasoning,
              completedAt: new Date()
            }
          })
        } catch (error) {
          console.error(`[XRay Queue] Failed to update completed job in database:`, error)
        }
      }

      if (this.config.debug) {
        console.log(`[XRay Queue] ✅ Generated reasoning for ${job.executionId}/${job.stepName}`)
      }

    } catch (error: any) {
      console.error(`[XRay Queue] ❌ Error processing job ${jobId}:`, error.message)
      await this.handleJobError(job, error)
    }
  }

  /**
   * Handle job error with retry logic
   */
  private async handleJobError(job: ReasoningJob, error: any): Promise<void> {
    const errorMessage = error.message || String(error)
    job.error = errorMessage

    const isRetryable = this.isRetryableError(error)

    if (isRetryable && job.attempt < this.config.maxRetries) {
      // Schedule retry with exponential backoff
      const delay = this.config.retryDelays[job.attempt - 1] || 8000
      job.attempt++
      job.status = 'pending'
      job.nextRetryAt = new Date(Date.now() + delay).toISOString()

      console.warn(
        `[XRay Queue] Retry ${job.attempt}/${this.config.maxRetries} for ${job.stepName} in ${delay}ms`
      )

      setTimeout(() => {
        this.queue.add(() => this.processJob(job.id))
      }, delay)

    } else {
      // Max retries reached
      job.status = 'failed'
      job.completedAt = new Date().toISOString()

      if (this.prisma) {
        try {
          await this.prisma.reasoningJob.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              error: errorMessage,
              attempts: job.attempt,
              completedAt: new Date()
            }
          })
        } catch (dbError) {
          console.error(`[XRay Queue] Failed to update failed job in database:`, dbError)
        }
      }

      console.error(
        `[XRay Queue] ✗ Failed to generate reasoning for ${job.executionId}/${job.stepName} after ${job.attempt} attempts`
      )
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error.message || String(error)
    const errorCode = error.code

    const retryablePatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'rate_limit_exceeded',
      'service_unavailable',
      'timeout',
      '429',
      '503',
      '502',
    ]

    return retryablePatterns.some(pattern =>
      errorMessage.includes(pattern) || errorCode === pattern
    )
  }

  /**
   * Process all steps in an execution
   */
  async processExecution(executionId: string): Promise<void> {
    const jobIds = await this.enqueueExecution(executionId)

    if (jobIds.length === 0) {
      if (this.config.debug) {
        console.log(`[XRay Queue] No pending reasoning for execution ${executionId}`)
      }
      return
    }

    console.log(`[XRay Queue] Processing ${jobIds.length} steps for execution ${executionId}`)
    await this.queue.onIdle()
    console.log(`[XRay Queue] ✓ Completed processing for execution ${executionId}`)
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const jobs = Array.from(this.jobs.values())

    return {
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      totalJobs: jobs.length
    }
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ReasoningJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Clear all jobs
   */
  clear(): void {
    this.jobs.clear()
  }

  /**
   * Get underlying p-queue
   */
  get pqueue(): PQueue {
    return this.queue
  }
}
