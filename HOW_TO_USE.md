# How to Use X-Ray Library

This guide shows you exactly how to use the X-Ray library in your projects.

## 📦 Library Status

✅ **READY TO USE** - The library is built and ready for integration!

```
x-ray-library/
├── src/           # TypeScript source code
├── dist/          # Compiled JavaScript (built ✅)
├── examples/      # Working examples
├── README.md      # Full documentation
├── USAGE.md       # Integration guide
└── QUICKSTART.md  # Quick start guide
```

## 🚀 Option 1: Use Locally in Your X-Ray Dashboard

To use this library in the existing x-ray dashboard project:

### Step 1: Build and Link the Library

```bash
# In x-ray-library directory
cd /Users/durgesh/Desktop/projects/equall-collective/x-ray-library
npm run build
npm link
```

### Step 2: Link in Your Dashboard Project

```bash
# In x-ray directory
cd /Users/durgesh/Desktop/projects/equall-collective/x-ray
npm link @xray/sdk
```

### Step 3: Replace Imports

**Before:**
```typescript
import { XRay } from '@/xRay/xray'
import { getExecutionById } from '@/lib/storage'
```

**After:**
```typescript
import { XRay, DatabaseStorage } from '@xray/sdk'
import { prisma } from '@/lib/prisma'

const storage = new DatabaseStorage(prisma)
```

### Step 4: Update Your Code

**lib/xray.ts** (new file):
```typescript
import { DatabaseStorage, ReasoningQueue, createOpenAIGenerator } from '@xray/sdk'
import { prisma } from './prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const storage = new DatabaseStorage(prisma)
export const generator = createOpenAIGenerator(openai)
export const reasoningQueue = new ReasoningQueue(
  storage,
  generator,
  {
    concurrency: 3,
    maxRetries: 4,
    debug: process.env.NODE_ENV === 'development'
  },
  prisma
)
```

**app/api/run-pipeline/route.ts**:
```typescript
import { XRay } from '@xray/sdk'
import { storage } from '@/lib/xray'
import { randomUUID } from 'crypto'

export async function POST() {
  const executionId = randomUUID()
  const xray = new XRay(executionId, { projectId: 'demo' }, storage)

  // Your pipeline logic...
  xray.startStep('step1', { input: 'data' })
  const result = await doSomething()
  xray.endStep('step1', { output: result })

  const execution = xray.end({ success: true })
  await xray.save()

  return Response.json({ executionId })
}
```

## 🚀 Option 2: Use in a New Project

### Step 1: Create Project and Install

```bash
# Create new project
mkdir my-project
cd my-project
npm init -y

# Install X-Ray library locally
npm link @xray/sdk

# Or publish first, then:
# npm install @xray/sdk

# Install peer dependencies
npm install p-queue
npm install @prisma/client  # If using database
npm install openai          # If using AI reasoning
```

### Step 2: Setup Prisma (if using database)

```bash
npx prisma init
```

Add the X-Ray schema to `prisma/schema.prisma` (see [QUICKSTART.md](QUICKSTART.md))

```bash
npx prisma migrate dev --name add_xray
npx prisma generate
```

### Step 3: Create Your Pipeline

```typescript
// pipeline.ts
import { XRay, DatabaseStorage, ReasoningQueue, createOpenAIGenerator } from '@xray/sdk'
import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

const prisma = new PrismaClient()
const storage = new DatabaseStorage(prisma)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const queue = new ReasoningQueue(
  storage,
  createOpenAIGenerator(openai),
  { concurrency: 3 }
)

export async function runPipeline(executionId: string) {
  const xray = new XRay(executionId, { projectId: 'demo' }, storage)

  // Track your pipeline steps
  xray.startStep('fetch_data', { query: 'shoes' })
  const data = await fetchData('shoes')
  xray.endStep('fetch_data', { count: data.length })

  xray.startStep('process', { items: data.length })
  const result = await process(data)
  xray.endStep('process', { output: result })

  // Save execution
  const execution = xray.end({ success: true })
  await xray.save()

  // Optional: enqueue reasoning
  await xray.enqueueReasoning(queue)

  return execution
}
```

### Step 4: Run It

```typescript
// main.ts
import { runPipeline } from './pipeline'
import { randomUUID } from 'crypto'

async function main() {
  const executionId = randomUUID()
  const execution = await runPipeline(executionId)
  console.log('✅ Execution saved:', execution.executionId)
}

main().catch(console.error)
```

## 🧪 Option 3: Test with Examples

Run the included examples:

```bash
cd x-ray-library

# Install dependencies
npm install

# Build the library
npm run build

# Install ts-node for running examples
npm install -g ts-node

# Run basic example
ts-node examples/basic.ts

# Run reasoning example
ts-node examples/with-reasoning.ts
```

## 📚 Documentation

- **[README.md](README.md)** - Complete API documentation
- **[USAGE.md](USAGE.md)** - Detailed integration guide with Next.js and Express
- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[LIBRARY_SUMMARY.md](LIBRARY_SUMMARY.md)** - What changed from the original app

## 🎯 Common Use Cases

### Use Case 1: Just Track Executions (No Reasoning)

```typescript
import { XRay, MemoryStorage } from '@xray/sdk'

const storage = new MemoryStorage()
const xray = new XRay('exec-1', {}, storage)

xray.startStep('step1', { input: 'data' })
const result = await doSomething()
xray.endStep('step1', { result })

await xray.save()
```

### Use Case 2: Track + Database Storage

```typescript
import { XRay, DatabaseStorage } from '@xray/sdk'
import { prisma } from './prisma'

const storage = new DatabaseStorage(prisma)
const xray = new XRay('exec-1', {}, storage)

// ... track steps ...
await xray.save() // Saves to PostgreSQL
```

### Use Case 3: Track + Database + AI Reasoning

```typescript
import { XRay, DatabaseStorage, ReasoningQueue, createOpenAIGenerator } from '@xray/sdk'
import { prisma } from './prisma'
import OpenAI from 'openai'

const storage = new DatabaseStorage(prisma)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const queue = new ReasoningQueue(
  storage,
  createOpenAIGenerator(openai),
  { concurrency: 3 }
)

const xray = new XRay('exec-1', {}, storage)
// ... track steps ...
await xray.save()
await xray.enqueueReasoning(queue) // Generate AI reasoning
```

### Use Case 4: On-Demand Reasoning (Recommended for APIs)

```typescript
// API endpoint - just save
const xray = new XRay('exec-1', {}, storage)
// ... track steps ...
await xray.save()
return { executionId } // Returns instantly

// Later, when viewing execution detail page
await queue.processExecution(executionId) // Generate reasoning now
```

## 🔧 Publishing to npm (Optional)

If you want to share this library publicly:

```bash
cd x-ray-library

# Login to npm
npm login

# Publish (first time)
npm publish --access public

# Update version and publish again
npm version patch  # or minor, or major
npm publish
```

Then anyone can install:
```bash
npm install @xray/sdk
```

## ⚙️ Configuration Options

### Storage Providers

```typescript
// In-memory (testing)
import { MemoryStorage } from '@xray/sdk'
const storage = new MemoryStorage()

// Database (production)
import { DatabaseStorage } from '@xray/sdk'
const storage = new DatabaseStorage(prisma)

// Custom (implement StorageProvider interface)
class MyStorage implements StorageProvider {
  // ... implement methods ...
}
```

### Reasoning Generators

```typescript
// OpenAI (recommended)
import { createOpenAIGenerator } from '@xray/sdk'
const generator = createOpenAIGenerator(openai)

// Simple (no API calls)
import { createSimpleGenerator } from '@xray/sdk'
const generator = createSimpleGenerator()

// Custom
const generator = async (step) => {
  return `My custom reasoning for ${step.name}`
}
```

### Queue Configuration

```typescript
import { createReasoningConfig } from '@xray/sdk'

const config = createReasoningConfig({
  concurrency: 5,      // Parallel jobs
  maxRetries: 4,       // Retry attempts
  debug: true          // Enable logging
})

const queue = new ReasoningQueue(storage, generator, config)
```

## 🐛 Troubleshooting

### Error: Cannot find module '@xray/sdk'

**Solution 1 (Local):**
```bash
cd x-ray-library
npm run build
npm link

cd ../your-project
npm link @xray/sdk
```

**Solution 2 (Published):**
```bash
npm install @xray/sdk
```

### Error: Prisma schema not found

**Solution:**
```bash
npx prisma migrate dev --name add_xray
npx prisma generate
```

### Error: OpenAI API key missing

**Solution:**
```bash
echo "OPENAI_API_KEY=sk-..." >> .env
```

Or use simple generator (no API key needed):
```typescript
import { createSimpleGenerator } from '@xray/sdk'
const generator = createSimpleGenerator()
```

## 📞 Support

Questions? Issues?
- Check [README.md](README.md) for full API docs
- See [examples/](examples/) for working code
- Read [USAGE.md](USAGE.md) for integration patterns

## ✅ Summary

The X-Ray library is **ready to use** right now. You can:

1. ✅ Link it locally with `npm link @xray/sdk`
2. ✅ Import it in your code: `import { XRay } from '@xray/sdk'`
3. ✅ Use any storage provider (memory or database)
4. ✅ Add AI reasoning with OpenAI
5. ✅ Run the examples to see it in action

**The library is complete and functional!**
