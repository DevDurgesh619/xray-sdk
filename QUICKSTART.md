# X-Ray SDK - Quick Start

Get started with X-Ray in under 5 minutes.

## Installation

```bash
npm install @xray/sdk p-queue
```

## 1. Basic Usage (30 seconds)

Track your pipeline execution:

```typescript
import { XRay, MemoryStorage } from '@xray/sdk'

const storage = new MemoryStorage()
const xray = new XRay('my-exec-1', {}, storage)

// Track steps
xray.startStep('step1', { input: 'data' })
const result = await myFunction()
xray.endStep('step1', { output: result })

// Save
const execution = xray.end({ success: true })
await xray.save()
```

## 2. With Database (5 minutes)

### Add Prisma Schema

```prisma
// prisma/schema.prisma
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

### Run Migration

```bash
npx prisma migrate dev --name add_xray
npx prisma generate
```

### Use Database Storage

```typescript
import { XRay, DatabaseStorage } from '@xray/sdk'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const storage = new DatabaseStorage(prisma)

const xray = new XRay('my-exec-1', {}, storage)
// ... track steps ...
await xray.save() // Saves to database
```

## 3. With AI Reasoning (5 minutes)

```typescript
import {
  XRay,
  DatabaseStorage,
  ReasoningQueue,
  createOpenAIGenerator
} from '@xray/sdk'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const generator = createOpenAIGenerator(openai)

const queue = new ReasoningQueue(
  storage,
  generator,
  { concurrency: 3 }
)

// Run pipeline
const xray = new XRay('my-exec-1', {}, storage)
xray.startStep('search', { query: 'laptops' })
xray.endStep('search', { found: 100 })
const execution = xray.end({ success: true })
await xray.save()

// Generate reasoning (async)
await xray.enqueueReasoning(queue)
```

## Next Steps

- Read [README.md](README.md) for full documentation
- See [USAGE.md](USAGE.md) for integration guide
- Check [examples/](examples/) for more examples

## Local Development

To use the library locally before publishing:

```bash
# In x-ray-library directory
npm install
npm run build
npm link

# In your project
npm link @xray/sdk
```

## Publishing to npm

```bash
# Login to npm
npm login

# Publish
npm publish --access public
```

## Support

- GitHub: https://github.com/yourusername/xray-sdk
- Issues: https://github.com/yourusername/xray-sdk/issues
