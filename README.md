# X-Ray SDK

**AI-powered observability for multi-step pipelines**

X-Ray is a lightweight SDK that automatically tracks pipeline executions and generates human-readable reasoning for each step using LLMs.

## Features

✨ **Automatic Step Tracking** - Track pipeline execution with simple `startStep()` / `endStep()` calls
🤖 **AI-Powered Reasoning** - Generate natural language explanations for each step using OpenAI
💾 **Flexible Storage** - In-memory or database-backed (Prisma + PostgreSQL)
⚡ **Async Processing** - Non-blocking reasoning generation with retry logic
🔄 **On-Demand Generation** - Only generate reasoning when you need it (cost savings)
📊 **Job Queue** - Built-in queue for managing concurrent LLM calls

## Installation

```bash
npm install @xray/sdk p-queue
```

### Optional Dependencies

```bash
# For database storage
npm install @prisma/client

# For OpenAI reasoning
npm install openai
```

## Quick Start

### Basic Usage (In-Memory)

```typescript
import { XRay, MemoryStorage } from '@xray/sdk'

const storage = new MemoryStorage()
const xray = new XRay('my-execution-1', { projectId: 'demo' }, storage)

// Track a step
xray.startStep('fetch_data', { query: 'shoes' })
const data = await fetchData('shoes')
xray.endStep('fetch_data', { results: data.length })

// End execution
const execution = xray.end({ success: true })
await xray.save()

console.log('Execution saved:', execution.executionId)
```

### With Database Storage (Prisma)

```typescript
import { XRay, DatabaseStorage } from '@xray/sdk'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const storage = new DatabaseStorage(prisma)

const xray = new XRay('my-execution-2', { projectId: 'demo' }, storage)

// Track steps
xray.startStep('step1', { input: 'data' })
xray.endStep('step1', { output: 'result' })

// Save to database
const execution = xray.end({ success: true })
await xray.save()
```

### With AI Reasoning (OpenAI)

```typescript
import {
  XRay,
  DatabaseStorage,
  ReasoningQueue,
  createOpenAIGenerator
} from '@xray/sdk'
import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

const prisma = new PrismaClient()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Setup storage and reasoning
const storage = new DatabaseStorage(prisma)
const generator = createOpenAIGenerator(openai)
const queue = new ReasoningQueue(
  storage,
  generator,
  { concurrency: 3, debug: true },
  prisma
)

// Run pipeline
const xray = new XRay('my-execution-3', { projectId: 'demo' }, storage)

xray.startStep('search', { query: 'laptops' })
const results = await search('laptops')
xray.endStep('search', { count: results.length })

xray.startStep('filter', { threshold: 4.5 })
const filtered = results.filter(r => r.rating >= 4.5)
xray.endStep('filter', { remaining: filtered.length })

// Save execution (without reasoning)
const execution = xray.end({ success: true })
await xray.save()

// Enqueue reasoning generation (async)
await xray.enqueueReasoning(queue)

console.log('✅ Execution saved, reasoning generating in background')
```

### On-Demand Reasoning (Recommended)

Instead of auto-generating reasoning, trigger it only when viewing an execution:

```typescript
// Pipeline API - just save execution
const execution = xray.end({ success: true })
await xray.save()
return { executionId: execution.executionId } // Returns instantly

// Later, when user views execution detail page
await queue.processExecution(executionId) // Generate reasoning now
```

This approach:
- ✅ API responds instantly (~150ms)
- ✅ Saves LLM costs (only generate for executions users actually view)
- ✅ Better user experience

## API Reference

### XRay

```typescript
class XRay {
  constructor(executionId: string, metadata?: Record<string, any>, storage?: StorageProvider)

  // V1 API (backward compatible)
  logStep(step: { name: string, input: any, output: any, metadata?: any }): void

  // V2 API (recommended)
  startStep(name: string, input: any, metadata?: any): void
  endStep(name: string, output: any): void
  errorStep(name: string, error: Error): void

  end(finalOutcome: any): Execution
  save(): Promise<void>
  enqueueReasoning(queue: ReasoningQueue): Promise<void>
  getExecution(): Execution
}
```

### StorageProvider

```typescript
interface StorageProvider {
  saveExecution(execution: Execution): Promise<void>
  getExecutionById(executionId: string): Promise<Execution | undefined>
  getAllExecutions(): Promise<Execution[]>
  updateStepReasoning(executionId: string, stepName: string, reasoning: string): Promise<void>
}
```

**Implementations:**
- `MemoryStorage` - In-memory storage (testing)
- `DatabaseStorage` - Prisma + PostgreSQL (production)

### ReasoningQueue

```typescript
class ReasoningQueue {
  constructor(
    storage: StorageProvider,
    generator: ReasoningGenerator,
    config?: Partial<ReasoningConfig>,
    prismaClient?: any
  )

  enqueue(executionId: string, stepName: string): Promise<string>
  enqueueExecution(executionId: string): Promise<string[]>
  processExecution(executionId: string): Promise<void>
  getStats(): QueueStats
  getJob(jobId: string): ReasoningJob | undefined
}
```

### Reasoning Generators

```typescript
// OpenAI-powered reasoning
const generator = createOpenAIGenerator(openaiClient)

// Simple reasoning (no LLM)
const generator = createSimpleGenerator()

// Custom reasoning
const generator: ReasoningGenerator = async (step: Step) => {
  return `My custom reasoning for ${step.name}`
}
```

## Configuration

### Reasoning Config

```typescript
interface ReasoningConfig {
  concurrency: number      // Parallel LLM calls (default: 3)
  maxRetries: number       // Max retries per job (default: 4)
  retryDelays: number[]    // Backoff delays in ms (default: [1000, 2000, 4000, 8000])
  debug: boolean           // Enable logging (default: false)
}

const config = createReasoningConfig({
  concurrency: 5,
  maxRetries: 3,
  debug: true
})

const queue = new ReasoningQueue(storage, generator, config)
```

## Prisma Schema

If using `DatabaseStorage`, add this to your Prisma schema:

```prisma
model Execution {
  id            String      @id @default(cuid())
  executionId   String      @unique
  projectId     String      @default("default")
  metadata      Json?
  finalOutcome  Json?
  startedAt     DateTime    @default(now())
  completedAt   DateTime?
  steps         Step[]
  reasoningJobs ReasoningJob[]
}

model Step {
  id            String      @id @default(cuid())
  executionId   String
  execution     Execution   @relation(fields: [executionId], references: [id], onDelete: Cascade)
  name          String
  input         Json?
  output        Json?
  error         String?
  durationMs    Int?
  reasoning     String?
  createdAt     DateTime    @default(now())
}

model ReasoningJob {
  id            String      @id @default(cuid())
  executionId   String
  execution     Execution   @relation(fields: [executionId], references: [id], onDelete: Cascade)
  stepName      String
  status        String
  reasoning     String?
  error         String?
  attempts      Int         @default(0)
  createdAt     DateTime    @default(now())
  completedAt   DateTime?

  @@unique([executionId, stepName])
}
```

Then run:
```bash
npx prisma migrate dev --name add_xray
npx prisma generate
```

## Examples

### Example 1: Simple Pipeline

```typescript
import { XRay, MemoryStorage } from '@xray/sdk'

async function runPipeline() {
  const storage = new MemoryStorage()
  const xray = new XRay('exec-1', {}, storage)

  xray.startStep('fetch', { url: 'https://api.example.com' })
  const data = await fetch('https://api.example.com').then(r => r.json())
  xray.endStep('fetch', { count: data.length })

  xray.startStep('process', { data })
  const processed = data.map(d => d.value * 2)
  xray.endStep('process', { result: processed })

  const execution = xray.end({ total: processed.length })
  await xray.save()

  return execution
}
```

### Example 2: With Error Handling

```typescript
xray.startStep('risky_operation', { input: 'data' })
try {
  const result = await riskyOperation()
  xray.endStep('risky_operation', { result })
} catch (error) {
  xray.errorStep('risky_operation', error as Error)
}
```

### Example 3: Custom Storage

```typescript
import { StorageProvider, Execution } from '@xray/sdk'

class S3Storage implements StorageProvider {
  async saveExecution(execution: Execution): Promise<void> {
    // Upload to S3
    await s3.putObject({
      Bucket: 'my-bucket',
      Key: `executions/${execution.executionId}.json`,
      Body: JSON.stringify(execution)
    })
  }

  async getExecutionById(id: string): Promise<Execution | undefined> {
    // Download from S3
    const obj = await s3.getObject({
      Bucket: 'my-bucket',
      Key: `executions/${id}.json`
    })
    return JSON.parse(obj.Body.toString())
  }

  // ... implement other methods
}
```

## Best Practices

### 1. Use On-Demand Reasoning

Don't generate reasoning on every pipeline run - only when users view executions:

```typescript
// ❌ Bad: Auto-generate reasoning (slow, expensive)
await xray.save()
await xray.enqueueReasoning(queue) // Blocks API response
return { executionId }

// ✅ Good: Generate on-demand (fast, cost-effective)
await xray.save()
return { executionId } // Returns instantly

// Later, when viewing execution:
await queue.processExecution(executionId)
```

### 2. Use Database Storage in Production

```typescript
// ❌ Bad: In-memory (data lost on restart)
const storage = new MemoryStorage()

// ✅ Good: Database-backed (persistent)
const storage = new DatabaseStorage(prisma)
```

### 3. Configure Concurrency

```typescript
// Balance API costs vs speed
const queue = new ReasoningQueue(storage, generator, {
  concurrency: 3, // 3 parallel LLM calls
  maxRetries: 4,  // Retry failed jobs
  debug: true     // Enable logging
})
```

### 4. Handle Errors Gracefully

```typescript
xray.startStep('step', { input })
try {
  const result = await operation()
  xray.endStep('step', { result })
} catch (error) {
  xray.errorStep('step', error as Error)
  // Continue pipeline or throw
}
```

## TypeScript

Full TypeScript support with type definitions:

```typescript
import { Execution, Step, ReasoningJob, QueueStats } from '@xray/sdk'

const execution: Execution = xray.getExecution()
const stats: QueueStats = queue.getStats()
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

- GitHub Issues: https://github.com/yourusername/xray-sdk/issues
- Documentation: https://xray-sdk.dev
