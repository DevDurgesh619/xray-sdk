# xray-sdk

**AI-powered observability for multi-step pipelines**

Track your pipeline executions with automatic AI reasoning that explains "WHY" decisions were made. Debug faster with step-by-step insights and visual exploration.

---

## 📦 Installation

```bash
npm install xray-sdk
```

---

## 🚀 Complete Setup Guide

Follow these steps to integrate X-Ray into your pipeline:

### Step 1: Get Your API Key

1. Visit the X-Ray Dashboard: **https://x-ray-library-sdk-git-main-devdurgesh619s-projects.vercel.app**
2. Click **"Create Account"** to sign up
3. Go to **"API Keys"** page: https://x-ray-library-sdk-git-main-devdurgesh619s-projects.vercel.app/api-key
4. Click **"Generate New Key"** and copy your API key (format: `xray_xxxxx...`)

### Step 2: Configure Environment Variables

Create a `.env` file in your project root:

```bash
# X-Ray Dashboard Configuration
XRAY_API_URL="https://x-ray-library-sdk-git-main-devdurgesh619s-projects.vercel.app"

# Your API key from Step 1
XRAY_API_KEY="xray_your_api_key_here"

# Optional: Only needed for client-side reasoning (advanced)
OPENAI_API_KEY="sk-..."
```

### Step 3: Create HTTP Client Wrapper

Create a file `src/lib/xrayClient.ts` to handle API communication:

```typescript
interface Execution {
  executionId: string
  startedAt: string
  endedAt?: string
  steps: Array<{
    name: string
    input?: any
    output?: any
    error?: string
    durationMs?: number
  }>
  finalOutcome?: any
  metadata?: Record<string, any>
}

export class XRayClient {
  private apiUrl: string
  private apiKey: string

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl
    this.apiKey = apiKey
  }

  async saveExecution(execution: Execution): Promise<{ executionId: string }> {
    const response = await fetch(\`\${this.apiUrl}/api/logs\`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(execution)
    })

    if (!response.ok) {
      throw new Error(\`X-Ray API Error: \${response.statusText}\`)
    }

    return await response.json()
  }
}

// Helper function to create client from environment variables
export function createXRayClient(): XRayClient {
  const apiUrl = process.env.XRAY_API_URL
  const apiKey = process.env.XRAY_API_KEY

  if (!apiUrl || !apiKey) {
    throw new Error('Missing XRAY_API_URL or XRAY_API_KEY in environment')
  }

  return new XRayClient(apiUrl, apiKey)
}
```

**💡 Tip:** See the full implementation at \`demo-app/src/lib/xrayClient.ts\` in the repository.

### Step 4: Track Your Pipeline with XRay

Wrap your pipeline logic with X-Ray tracking:

```typescript
import { XRay } from 'xray-sdk'
import { createXRayClient } from './lib/xrayClient'

async function myPipeline() {
  // 1. Create XRay instance with unique execution ID
  const executionId = \`pipeline-\${Date.now()}\`
  const xray = new XRay(executionId, {
    pipeline: 'my-pipeline-name',
    domain: 'data-processing'  // Optional metadata
  })

  // 2. Track each step with startStep() and endStep()

  // Step 1: Fetch data
  xray.startStep('fetch_data', { source: 'api.example.com', limit: 100 })
  const data = await fetchData()
  xray.endStep('fetch_data', { records: data.length, size_kb: 45 })

  // Step 2: Process data
  xray.startStep('process_data', { records: data.length })
  const processed = processData(data)
  xray.endStep('process_data', {
    processed: processed.length,
    skipped: data.length - processed.length
  })

  // Step 3: Save results
  xray.startStep('save_results', { records: processed.length })
  await saveResults(processed)
  xray.endStep('save_results', { success: true })

  // 3. Complete execution
  const execution = xray.end({
    status: 'success',
    total_processed: processed.length
  })

  // 4. Send to X-Ray Dashboard
  const client = createXRayClient()
  await client.saveExecution(execution)

  // 5. View in dashboard
  console.log(\`✅ View execution: https://x-ray-library-sdk-git-main-devdurgesh619s-projects.vercel.app/execution/\${executionId}\`)
}
```

### Step 5: View Results in Dashboard

1. Run your pipeline: \`npm run your-pipeline-command\`
2. Copy the execution URL from console output
3. Open the URL in your browser
4. Watch AI reasoning generate automatically for each step

**✨ AI Reasoning explains:**
- WHY this step produced this output
- What metrics/thresholds drove the decision
- What might be wrong if numbers look suspicious

Example reasoning:
> "Only 3/10 candidates met minRating≥4.0 AND minReviews≥100; 7 failed due to low ratings/reviews"

---

## 📚 Complete Examples

See the \`demo-app/\` directory for production-ready examples:

### Example 1: Basic Data Pipeline

**File:** \`demo-app/src/1-basic-example.ts\`

```typescript
import { XRay } from 'xray-sdk'
import { createXRayClient } from './lib/xrayClient'

const xray = new XRay(\`basic-\${Date.now()}\`, {
  pipeline: 'data-ingestion'
})

// Track data ingestion
xray.startStep('ingest', { source: 'api', limit: 1000 })
const rawData = await fetch('https://api.example.com/data')
xray.endStep('ingest', { records: 1000, size_mb: 2.3 })

// Track validation
xray.startStep('validate', { records: 1000 })
const valid = rawData.filter(isValid)
xray.endStep('validate', {
  valid: valid.length,
  invalid: rawData.length - valid.length
})

const execution = xray.end({ status: 'success' })
await createXRayClient().saveExecution(execution)
```

### Example 2: E-Commerce Competitor Selection

**File:** \`demo-app/src/2-ecommerce-example.ts\`

```typescript
import { XRay } from 'xray-sdk'
import { createXRayClient } from './lib/xrayClient'

const xray = new XRay(\`ecommerce-\${Date.now()}\`, {
  pipeline: 'competitor-selection',
  domain: 'e-commerce'
})

// Step 1: Generate search keywords
xray.startStep('generate_keywords', {
  product_title: 'Water Bottle 32oz Insulated'
})
const keywords = ['water bottle', 'insulated bottle', '32oz bottle']
xray.endStep('generate_keywords', { keywords, count: 3 })

// Step 2: Search for candidates
xray.startStep('search_competitors', { keywords, limit: 50 })
const candidates = await searchAmazon(keywords)
xray.endStep('search_competitors', {
  total_results: 2847,
  candidates_fetched: 10
})

// Step 3: Filter and select best competitor
xray.startStep('filter_and_select', {
  candidates: 10,
  filters: { minRating: 4.0, minReviews: 100 }
})
const filtered = candidates.filter(c => c.rating >= 4.0 && c.reviews >= 100)
const selected = filtered[0]
xray.endStep('filter_and_select', {
  passed: 3,
  failed: 7,
  selected: selected.title
})

const execution = xray.end({
  competitor: selected,
  confidence: 0.95
})
await createXRayClient().saveExecution(execution)
```

### Example 3: Error Handling

**File:** \`demo-app/src/3-error-handling-example.ts\`

```typescript
import { XRay } from 'xray-sdk'
import { createXRayClient } from './lib/xrayClient'

const xray = new XRay(\`error-demo-\${Date.now()}\`, {
  pipeline: 'risky-pipeline'
})

xray.startStep('risky_operation', { input: 'data' })
try {
  const result = await riskyOperation()
  xray.endStep('risky_operation', { result })
} catch (error) {
  // Track errors with errorStep()
  xray.errorStep('risky_operation', error as Error)
}

const execution = xray.end({ status: 'failed' })
await createXRayClient().saveExecution(execution)

// Dashboard will show error with AI reasoning explaining what went wrong
```

### Example 4: Movie Recommendation Pipeline

**File:** \`demo-app/src/4-movie-example.ts\`

```typescript
import { XRay } from 'xray-sdk'
import { createXRayClient } from './lib/xrayClient'

const xray = new XRay(\`movie-\${Date.now()}\`, {
  pipeline: 'movie-recommendation',
  domain: 'entertainment'
})

// Step 1: Extract themes from favorite movie
xray.startStep('extract_themes', { movie: 'Inception' })
const themes = ['time manipulation', 'mind-bending', 'layered reality']
xray.endStep('extract_themes', { themes, count: 3 })

// Step 2: Search for similar movies
xray.startStep('search_movies', { themes, limit: 20 })
const candidates = await searchMovies(themes)
xray.endStep('search_movies', { total: 47, fetched: 20 })

// Step 3: Filter by criteria
xray.startStep('filter_movies', {
  candidates: 20,
  minRating: 7.5,
  maxAge: 15
})
const filtered = candidates.filter(m => m.rating >= 7.5 && m.yearsSinceRelease <= 15)
xray.endStep('filter_movies', { passed: 5, failed: 15 })

// Step 4: Score and rank
xray.startStep('score_and_rank', { movies: 5 })
const scored = scoreMovies(filtered)
const topPick = scored[0]
xray.endStep('score_and_rank', { top_score: topPick.score })

// Step 5: Get metadata
xray.startStep('get_metadata', { movie_id: topPick.id })
const metadata = await getMovieMetadata(topPick.id)
xray.endStep('get_metadata', { title: metadata.title })

const execution = xray.end({
  recommendation: metadata,
  confidence: 0.92
})
await createXRayClient().saveExecution(execution)
```

---

## 🎯 Core API Reference

### XRay Class

```typescript
import { XRay } from 'xray-sdk'

// Create instance
const xray = new XRay(executionId: string, metadata?: Record<string, any>)

// Track steps
xray.startStep(name: string, input?: any)
xray.endStep(name: string, output?: any)
xray.errorStep(name: string, error: Error)

// Complete execution
const execution = xray.end(finalOutcome?: any)
```

### Key Methods

| Method | Description | Example |
|--------|-------------|---------|
| \`startStep(name, input?)\` | Start tracking a step | \`xray.startStep('fetch_data', { source: 'api' })\` |
| \`endStep(name, output?)\` | End step successfully | \`xray.endStep('fetch_data', { records: 1000 })\` |
| \`errorStep(name, error)\` | Mark step as failed | \`xray.errorStep('fetch_data', new Error('timeout'))\` |
| \`end(finalOutcome?)\` | Complete execution | \`xray.end({ status: 'success', total: 1000 })\` |

---

## 🔒 Security & Reasoning Options

X-Ray offers **two secure ways** to generate AI reasoning:

### Option 1: Server-Side Reasoning (Default, Recommended)

**How it works:**
1. Send execution WITHOUT reasoning to dashboard
2. Dashboard generates reasoning using its own OpenAI key
3. Reasoning appears automatically when you view the execution

**Pros:**
- ✅ No OpenAI API key needed from you
- ✅ Zero cost for you
- ✅ Zero setup required

**Code:**
```typescript
const execution = xray.end({ status: 'success' })
await client.saveExecution(execution)
// Dashboard will generate reasoning automatically
```

### Option 2: Client-Side Reasoning (Advanced)

**How it works:**
1. Generate reasoning locally using YOUR OpenAI key
2. Send execution WITH reasoning to dashboard
3. Your API key never leaves your infrastructure

**Pros:**
- ✅ Full control over OpenAI usage
- ✅ Works with sensitive data (never sent to dashboard)
- ✅ No dependency on dashboard's rate limits

**Code:**
```typescript
import { XRay, MemoryStorage, ReasoningQueue, createOpenAIGenerator } from 'xray-sdk'
import OpenAI from 'openai'

// 1. Track execution
const xray = new XRay(executionId, { pipeline: 'my-pipeline' })
xray.startStep('process', { input: 'data' })
xray.endStep('process', { output: 'result' })
const execution = xray.end({ status: 'success' })

// 2. Generate reasoning CLIENT-SIDE
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const storage = new MemoryStorage()
await storage.saveExecution(execution)

const generator = createOpenAIGenerator(openai)
const queue = new ReasoningQueue(storage, generator)
await queue.processExecution(executionId)

// 3. Get execution with reasoning
const executionWithReasoning = await storage.getExecutionById(executionId)

// 4. Send to dashboard
await client.saveExecution(executionWithReasoning)
```

**See:** \`demo-app/src/7-standalone-reasoning.ts\` for complete example

---

## 🏗️ Advanced Features

### Custom Storage

```typescript
import { MemoryStorage, DatabaseStorage } from 'xray-sdk'

// In-memory (for testing)
const storage = new MemoryStorage()

// Database (requires Prisma setup)
const storage = new DatabaseStorage(prisma, userId)
```

### Reasoning Queue Configuration

```typescript
import { ReasoningQueue, createOpenAIGenerator } from 'xray-sdk'

const queue = new ReasoningQueue(storage, generator, {
  concurrency: 3,      // Process 3 steps in parallel
  maxRetries: 4,       // Retry failed reasoning jobs
  debug: true          // Enable detailed logging
})

await queue.processExecution(executionId)
```

### TypeScript Types

```typescript
import { Execution, Step, XRay } from 'xray-sdk'

const execution: Execution = {
  executionId: 'exec-123',
  startedAt: '2024-01-01T00:00:00Z',
  endedAt: '2024-01-01T00:01:00Z',
  steps: [
    {
      name: 'step1',
      input: { data: 'test' },
      output: { result: 'success' },
      durationMs: 150
    }
  ],
  finalOutcome: { status: 'success' }
}
```

---

## 📊 Dashboard Features

The X-Ray Dashboard provides:

| Feature | Description |
|---------|-------------|
| **Execution List** | Browse all pipeline runs with status indicators |
| **Step-by-Step View** | Detailed breakdown showing input/output for each step |
| **AI Reasoning** | Automatic "WHY" explanations for decisions |
| **Real-Time Updates** | Watch reasoning generate live (polls every 2 seconds) |
| **JSON Viewer** | Inspect raw execution data |
| **Search & Filter** | Find executions by ID, pipeline name, or metadata |

**Dashboard URL:** https://x-ray-library-sdk-git-main-devdurgesh619s-projects.vercel.app

---

## 🎯 Use Cases

- **E-Commerce**: Competitor selection, product matching, price optimization
- **Content Recommendation**: Movie/music recommendations, personalization engines
- **Data Pipelines**: ETL processes, data validation, transformation workflows
- **LLM Workflows**: Multi-step AI reasoning, autonomous agent systems
- **Debugging**: Understand why pipeline decisions were made, identify bottlenecks

---

## ✅ Integration Checklist

Use this checklist to verify your integration:

- [ ] Install \`xray-sdk\` package (\`npm install xray-sdk\`)
- [ ] Create account on dashboard
- [ ] Get API key from https://x-ray-library-sdk-git-main-devdurgesh619s-projects.vercel.app/api-key
- [ ] Set environment variables (\`XRAY_API_URL\`, \`XRAY_API_KEY\`)
- [ ] Create HTTP client wrapper (\`src/lib/xrayClient.ts\`)
- [ ] Add \`XRay\` tracking to your pipeline (startStep/endStep)
- [ ] Test with a simple pipeline execution
- [ ] Verify execution appears in dashboard
- [ ] Verify AI reasoning generates automatically
- [ ] (Optional) Set up client-side reasoning for sensitive workloads

---

## 🚀 Quick Start Summary

```bash
# 1. Install
npm install xray-sdk

# 2. Get API key
# Visit: https://x-ray-library-sdk-git-main-devdurgesh619s-projects.vercel.app/api-key

# 3. Configure .env
XRAY_API_URL="https://x-ray-library-sdk-git-main-devdurgesh619s-projects.vercel.app"
XRAY_API_KEY="xray_your_key_here"

# 4. Copy HTTP client
# See: demo-app/src/lib/xrayClient.ts

# 5. Track your pipeline
# See: demo-app/src/2-ecommerce-example.ts

# 6. Run and view results
npm run your-pipeline
# Open execution URL in browser
```

---

## 📚 Additional Resources

- **Demo App**: See \`demo-app/\` directory for 5 production-ready examples
- **Main README**: See \`../README.md\` for project overview
- **Security Guide**: See \`../SECURITY.md\` for best practices
- **Architecture**: See \`../XRAY_ARCHITECTURE_OVERVIEW.md\` for system design

---

## 📝 License

ISC

---

## 🆘 Support

- **Dashboard**: https://x-ray-library-sdk-git-main-devdurgesh619s-projects.vercel.app
- **Get API Key**: https://x-ray-library-sdk-git-main-devdurgesh619s-projects.vercel.app/api-key
- **Examples**: See \`demo-app/\` directory in the repository

---

Start tracking your pipelines today with X-Ray! 🚀
