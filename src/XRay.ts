import { Execution, Step, StorageProvider } from "./types"
import { ReasoningQueue } from "./reasoning/queue"

export class XRay {
  private execution: Execution
  private activeSteps = new Map<string, Step>()
  private pendingReasoningSteps: string[] = []
  private storage?: StorageProvider

  constructor(
    executionId: string,
    metadata?: Record<string, any>,
    storage?: StorageProvider
  ) {
    this.execution = {
      executionId,
      startedAt: new Date().toISOString(),
      steps: [],
      metadata
    }
    this.storage = storage
  }

  /** ✅ BACKWARD-COMPATIBLE (v1) – no auto reasoning */
  logStep(step: {
    name: string
    input: any
    output: any
    metadata?: Record<string, any>
  }) {
    this.execution.steps.push({
      name: step.name,
      input: step.input,
      output: step.output,
      timestamp: new Date().toISOString(),
      metadata: step.metadata
      // reasoning can be added manually via metadata.reasoning if needed
    })
  }

  /** Start a step (v2) */
  startStep(name: string, input: any, metadata?: Record<string, any>) {
    const step: Step = {
      name,
      input,
      timestamp: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      metadata
    }
    this.activeSteps.set(name, step)
  }

  /** Finish a step (v3) – stores without reasoning (populated asynchronously) */
  endStep(name: string, output: any) {
    const step = this.activeSteps.get(name)
    if (!step) return

    step.output = output
    step.endedAt = new Date().toISOString()
    step.durationMs =
      new Date(step.endedAt).getTime() -
      new Date(step.startedAt!).getTime()

    // Store without reasoning (will be populated asynchronously)
    step.reasoning = undefined

    this.execution.steps.push(step)
    this.activeSteps.delete(name)

    // Track step for later processing
    this.pendingReasoningSteps.push(step.name)
  }

  /** Capture error inside a step (v2) – stores without reasoning (populated asynchronously) */
  errorStep(name: string, error: Error) {
    const step = this.activeSteps.get(name)
    if (!step) return

    step.error = error.message
    step.endedAt = new Date().toISOString()
    step.durationMs =
      new Date(step.endedAt).getTime() -
      new Date(step.startedAt!).getTime()

    // Store without reasoning (will be populated asynchronously)
    step.reasoning = undefined

    this.execution.steps.push(step)
    this.activeSteps.delete(name)

    // Track step for later processing
    this.pendingReasoningSteps.push(step.name)
  }

  /** End execution - returns execution without enqueueing reasoning */
  end(finalOutcome: any) {
    this.execution.endedAt = new Date().toISOString()
    this.execution.finalOutcome = finalOutcome
    return this.execution
  }

  /** Save execution to storage (if configured) */
  async save(): Promise<void> {
    if (this.storage) {
      await this.storage.saveExecution(this.execution)
    }
  }

  /** Enqueue reasoning jobs - call AFTER saveExecution() */
  async enqueueReasoning(queue: ReasoningQueue) {
    for (const stepName of this.pendingReasoningSteps) {
      await queue.enqueue(this.execution.executionId, stepName)
    }
  }

  /** Get the current execution */
  getExecution(): Execution {
    return this.execution
  }
}
