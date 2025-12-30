// Database storage implementation using Prisma
// Users must provide their own Prisma client instance
import { Execution, StorageProvider } from "../types"

export class DatabaseStorage implements StorageProvider {
  private prisma: any

  constructor(prismaClient: any) {
    this.prisma = prismaClient
  }

  /**
   * Save a complete execution to the database
   */
  async saveExecution(execution: Execution): Promise<void> {
    if (!execution || !execution.executionId || execution.steps.length === 0) {
      console.warn("Skipping invalid execution:", execution?.executionId)
      return
    }

    try {
      const existing = await this.prisma.execution.findUnique({
        where: { executionId: execution.executionId },
      })

      if (existing) {
        await this.prisma.execution.update({
          where: { executionId: execution.executionId },
          data: {
            metadata: execution.metadata || {},
            finalOutcome: execution.finalOutcome || {},
            completedAt: new Date(),
            steps: {
              deleteMany: {},
              create: execution.steps.map(step => ({
                name: step.name,
                input: step.input || {},
                output: step.output || {},
                error: step.error,
                durationMs: step.durationMs,
                reasoning: step.reasoning,
              })),
            },
          },
        })
        console.log(`[XRay Storage] ✅ Updated execution ${execution.executionId}`)
      } else {
        await this.prisma.execution.create({
          data: {
            executionId: execution.executionId,
            projectId: execution.metadata?.projectId || "default",
            metadata: execution.metadata || {},
            finalOutcome: execution.finalOutcome || {},
            steps: {
              create: execution.steps.map(step => ({
                name: step.name,
                input: step.input || {},
                output: step.output || {},
                error: step.error,
                durationMs: step.durationMs,
                reasoning: step.reasoning,
              })),
            },
          },
        })
        console.log(`[XRay Storage] ✅ Created execution ${execution.executionId}`)
      }
    } catch (error) {
      console.error(`[XRay Storage] ❌ Failed to save execution ${execution.executionId}:`, error)
      throw error
    }
  }

  /**
   * Get a single execution by ID
   */
  async getExecutionById(id: string): Promise<Execution | undefined> {
    try {
      const exec = await this.prisma.execution.findUnique({
        where: { executionId: id },
        include: {
          steps: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      })

      if (!exec) {
        return undefined
      }

      return {
        executionId: exec.executionId,
        startedAt: exec.startedAt.toISOString(),
        endedAt: exec.completedAt?.toISOString(),
        metadata: exec.metadata as any,
        finalOutcome: exec.finalOutcome as any,
        steps: exec.steps.map((step: any) => ({
          name: step.name,
          input: step.input as any,
          output: step.output as any,
          error: step.error || undefined,
          durationMs: step.durationMs || undefined,
          reasoning: step.reasoning || undefined,
          timestamp: step.createdAt.toISOString(),
        })),
      }
    } catch (error) {
      console.error(`[XRay Storage] ❌ Failed to get execution ${id}:`, error)
      return undefined
    }
  }

  /**
   * Get all executions
   */
  async getAllExecutions(): Promise<Execution[]> {
    try {
      const executions = await this.prisma.execution.findMany({
        include: {
          steps: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: 100,
      })

      return executions.map((exec: any) => ({
        executionId: exec.executionId,
        startedAt: exec.startedAt.toISOString(),
        endedAt: exec.completedAt?.toISOString(),
        metadata: exec.metadata as any,
        finalOutcome: exec.finalOutcome as any,
        steps: exec.steps.map((step: any) => ({
          name: step.name,
          input: step.input as any,
          output: step.output as any,
          error: step.error || undefined,
          durationMs: step.durationMs || undefined,
          reasoning: step.reasoning || undefined,
          timestamp: step.createdAt.toISOString(),
        })),
      }))
    } catch (error) {
      console.error("[XRay Storage] ❌ Failed to load executions:", error)
      return []
    }
  }

  /**
   * Update a single step's reasoning
   */
  async updateStepReasoning(
    executionId: string,
    stepName: string,
    reasoning: string
  ): Promise<void> {
    try {
      const execution = await this.prisma.execution.findUnique({
        where: { executionId },
        include: { steps: true },
      })

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`)
      }

      const step = execution.steps.find((s: any) => s.name === stepName)
      if (!step) {
        throw new Error(`Step ${stepName} not found in execution ${executionId}`)
      }

      await this.prisma.step.update({
        where: { id: step.id },
        data: { reasoning },
      })

      console.log(`[XRay Storage] ✅ Updated reasoning for ${executionId}/${stepName}`)
    } catch (error) {
      console.error(`[XRay Storage] ❌ Failed to update reasoning for ${executionId}/${stepName}:`, error)
      throw error
    }
  }
}
