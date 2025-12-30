// In-memory storage implementation for testing
import { Execution, StorageProvider } from "../types"

export class MemoryStorage implements StorageProvider {
  private executions: Map<string, Execution> = new Map()

  async saveExecution(execution: Execution): Promise<void> {
    this.executions.set(execution.executionId, JSON.parse(JSON.stringify(execution)))
    console.log(`[XRay Memory] ✅ Saved execution ${execution.executionId}`)
  }

  async getExecutionById(executionId: string): Promise<Execution | undefined> {
    const execution = this.executions.get(executionId)
    return execution ? JSON.parse(JSON.stringify(execution)) : undefined
  }

  async getAllExecutions(): Promise<Execution[]> {
    return Array.from(this.executions.values()).map(e =>
      JSON.parse(JSON.stringify(e))
    )
  }

  async updateStepReasoning(
    executionId: string,
    stepName: string,
    reasoning: string
  ): Promise<void> {
    const execution = this.executions.get(executionId)
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`)
    }

    const step = execution.steps.find(s => s.name === stepName)
    if (!step) {
      throw new Error(`Step ${stepName} not found in execution ${executionId}`)
    }

    step.reasoning = reasoning
    console.log(`[XRay Memory] ✅ Updated reasoning for ${executionId}/${stepName}`)
  }

  clear(): void {
    this.executions.clear()
  }
}
