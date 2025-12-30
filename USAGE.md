# X-Ray SDK - Usage Guide

This guide shows you how to integrate X-Ray SDK into your projects.

## Installation in Your Project

### Option 1: Local Development (npm link)

While developing the library locally:

```bash
# In x-ray-library directory
npm install
npm run build
npm link

# In your project directory
npm link @xray/sdk
```

### Option 2: Install from npm (after publishing)

```bash
npm install @xray/sdk
```

### Option 3: Install from GitHub

```bash
npm install github:yourusername/xray-sdk
```

## Integration Steps

### 1. Basic Integration (No Database)

Perfect for testing or small projects:

```typescript
// pipeline.ts
import { XRay, MemoryStorage } from '@xray/sdk'

const storage = new MemoryStorage()

export async function runMyPipeline(executionId: string) {
  const xray = new XRay(executionId, { projectId: 'my-project' }, storage)

  // Your pipeline logic
  xray.startStep('step1', { input: 'data' })
  const result1 = await doSomething()
  xray.endStep('step1', { output: result1 })

  xray.startStep('step2', { input: result1 })
  const result2 = await doSomethingElse(result1)
  xray.endStep('step2', { output: result2 })

  const execution = xray.end({ success: true })
  await xray.save()

  return { execution }
}
```

### 2. Integration with Database (Prisma)

For production applications:

#### Step 1: Add Prisma Schema

Add to your `prisma/schema.prisma`:

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

#### Step 2: Run Migration

```bash
npx prisma migrate dev --name add_xray
npx prisma generate
```

#### Step 3: Update Your Pipeline

```typescript
// lib/xray.ts
import { DatabaseStorage } from '@xray/sdk'
import { prisma } from './prisma' // Your Prisma client

export const storage = new DatabaseStorage(prisma)
```

```typescript
// pipeline.ts
import { XRay } from '@xray/sdk'
import { storage } from './lib/xray'

export async function runMyPipeline(executionId: string) {
  const xray = new XRay(executionId, { projectId: 'my-project' }, storage)

  // Your pipeline logic
  xray.startStep('step1', { input: 'data' })
  const result = await doSomething()
  xray.endStep('step1', { output: result })

  const execution = xray.end({ success: true })
  await xray.save() // Saves to database

  return { execution }
}
```

### 3. Integration with AI Reasoning (OpenAI)

Add automatic reasoning generation:

#### Step 1: Setup Reasoning Queue

```typescript
// lib/xray.ts
import {
  DatabaseStorage,
  ReasoningQueue,
  createOpenAIGenerator,
  createReasoningConfig
} from '@xray/sdk'
import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

export const prisma = new PrismaClient()
export const storage = new DatabaseStorage(prisma)

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Reasoning generator
const generator = createOpenAIGenerator(openai)

// Reasoning queue
const config = createReasoningConfig({
  concurrency: parseInt(process.env.XRAY_CONCURRENCY || '3'),
  maxRetries: 4,
  debug: process.env.NODE_ENV === 'development'
})

export const reasoningQueue = new ReasoningQueue(
  storage,
  generator,
  config,
  prisma
)
```

#### Step 2: Use in Pipeline (On-Demand)

```typescript
// app/api/run-pipeline/route.ts (Next.js example)
import { XRay } from '@xray/sdk'
import { storage } from '@/lib/xray'
import { randomUUID } from 'crypto'

export async function POST() {
  const executionId = randomUUID()
  const xray = new XRay(executionId, { projectId: 'my-project' }, storage)

  // Run pipeline
  xray.startStep('step1', { input: 'data' })
  const result = await doSomething()
  xray.endStep('step1', { output: result })

  const execution = xray.end({ success: true })
  await xray.save()

  // ❌ DON'T enqueue reasoning here - let user trigger it on-demand

  return Response.json({ executionId })
}
```

#### Step 3: Trigger Reasoning On-Demand

```typescript
// app/api/reasoning/process/route.ts
import { reasoningQueue } from '@/lib/xray'

export async function POST(request: Request) {
  const { executionId } = await request.json()

  // Enqueue reasoning for all steps without reasoning
  await reasoningQueue.processExecution(executionId)

  return Response.json({
    success: true,
    stats: reasoningQueue.getStats()
  })
}
```

#### Step 4: Frontend Trigger (React)

```typescript
// components/ExecutionReasoningTrigger.tsx
'use client'
import { useEffect } from 'react'

export default function ExecutionReasoningTrigger({
  executionId,
  hasAnyMissingReasoning
}: {
  executionId: string
  hasAnyMissingReasoning: boolean
}) {
  useEffect(() => {
    if (!hasAnyMissingReasoning) return

    const storageKey = `reasoningTriggered:${executionId}`
    const wasTriggered = localStorage.getItem(storageKey)

    if (!wasTriggered) {
      fetch('/api/reasoning/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId })
      }).then(response => {
        if (response.ok) {
          localStorage.setItem(storageKey, 'true')
        }
      })
    }
  }, [executionId, hasAnyMissingReasoning])

  return null // Side-effect only component
}
```

```typescript
// app/execution/[id]/page.tsx
import { storage } from '@/lib/xray'
import ExecutionReasoningTrigger from '@/components/ExecutionReasoningTrigger'

export default async function ExecutionPage({ params }: { params: { id: string } }) {
  const execution = await storage.getExecutionById(params.id)
  const hasAnyMissingReasoning = execution?.steps.some(s => !s.reasoning) ?? false

  return (
    <div>
      <ExecutionReasoningTrigger
        executionId={params.id}
        hasAnyMissingReasoning={hasAnyMissingReasoning}
      />

      {/* Display execution details */}
      <h1>Execution {execution?.executionId}</h1>
      {execution?.steps.map(step => (
        <div key={step.name}>
          <h3>{step.name}</h3>
          <p>{step.reasoning || 'Generating reasoning...'}</p>
        </div>
      ))}
    </div>
  )
}
```

## API Routes Examples

### Next.js App Router

```typescript
// app/api/executions/route.ts
import { storage } from '@/lib/xray'

export async function GET() {
  const executions = await storage.getAllExecutions()
  return Response.json(executions)
}
```

```typescript
// app/api/execution/[id]/route.ts
import { storage } from '@/lib/xray'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const execution = await storage.getExecutionById(params.id)
  if (!execution) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  return Response.json(execution)
}
```

### Express.js

```typescript
// routes/executions.ts
import express from 'express'
import { storage, reasoningQueue } from '../lib/xray'

const router = express.Router()

// Get all executions
router.get('/executions', async (req, res) => {
  const executions = await storage.getAllExecutions()
  res.json(executions)
})

// Get single execution
router.get('/execution/:id', async (req, res) => {
  const execution = await storage.getExecutionById(req.params.id)
  if (!execution) {
    return res.status(404).json({ error: 'Not found' })
  }
  res.json(execution)
})

// Trigger reasoning
router.post('/reasoning/process', async (req, res) => {
  const { executionId } = req.body
  await reasoningQueue.processExecution(executionId)
  res.json({ success: true, stats: reasoningQueue.getStats() })
})

export default router
```

## Environment Variables

```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
OPENAI_API_KEY="sk-..."

# Optional
XRAY_CONCURRENCY="3"
NODE_ENV="development"
```

## Testing

```typescript
// __tests__/pipeline.test.ts
import { XRay, MemoryStorage } from '@xray/sdk'

describe('Pipeline', () => {
  it('should track execution', async () => {
    const storage = new MemoryStorage()
    const xray = new XRay('test-exec', {}, storage)

    xray.startStep('test', { input: 'data' })
    xray.endStep('test', { output: 'result' })

    const execution = xray.end({ success: true })
    await xray.save()

    const retrieved = await storage.getExecutionById('test-exec')
    expect(retrieved?.steps).toHaveLength(1)
    expect(retrieved?.steps[0].name).toBe('test')
  })
})
```

## Troubleshooting

### Issue: "Module not found: @xray/sdk"

**Solution**: Make sure you've built the library:
```bash
cd x-ray-library
npm run build
npm link
```

### Issue: Prisma errors about missing tables

**Solution**: Run migrations:
```bash
npx prisma migrate dev
npx prisma generate
```

### Issue: Reasoning not generating

**Solution**: Check:
1. `OPENAI_API_KEY` is set
2. Queue is configured correctly
3. Reasoning is being triggered (check logs)
4. Database has ReasoningJob table

### Issue: "Cannot find module 'p-queue'"

**Solution**: Install peer dependencies:
```bash
npm install p-queue
```

## Next Steps

1. ✅ Install X-Ray SDK in your project
2. ✅ Add Prisma schema (if using database)
3. ✅ Integrate into your pipeline
4. ✅ Add reasoning queue (optional)
5. ✅ Create API routes for viewing executions
6. ✅ Build a dashboard UI

For more examples, see the `examples/` directory.
