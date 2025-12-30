# Publishing @xray/sdk to npm & Creating a Separate Repository

This guide walks you through publishing the X-Ray SDK library to npm and creating a demo application in a separate repository.

---

## Part 1: Publishing to a Separate GitHub Repository

### Step 1: Create a New GitHub Repository

1. Go to [GitHub](https://github.com/new)
2. Create a new repository:
   - **Name:** `xray-sdk` (or your preferred name)
   - **Description:** "TypeScript library for LLM pipeline observability and execution tracing"
   - **Visibility:** Public (for npm publishing)
   - **Initialize:** Don't add README, .gitignore, or license (we already have them)

### Step 2: Prepare the Library Folder

```bash
# Navigate to the library directory
cd /Users/durgesh/Desktop/projects/equall-collective/x-ray-library

# Initialize git if not already done
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: X-Ray SDK v0.1.0"
```

### Step 3: Push to GitHub

```bash
# Add your new GitHub repository as remote
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/xray-sdk.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 4: Set Up GitHub Repository

After pushing, configure your repository:

1. **Add Topics/Tags:**
   - `typescript`
   - `observability`
   - `llm`
   - `tracing`
   - `monitoring`
   - `sdk`

2. **Enable GitHub Pages** (optional):
   - Settings → Pages → Deploy from branch `main` → `/docs` folder
   - This can host your documentation

3. **Add Repository Description**:
   ```
   🔍 TypeScript SDK for LLM pipeline observability, execution tracing, and AI-powered reasoning
   ```

---

## Part 2: Publishing to npm

### Prerequisites

1. **Create npm Account:**
   - Go to [npmjs.com/signup](https://www.npmjs.com/signup)
   - Create an account if you don't have one

2. **Verify Email:**
   - Check your email and verify your npm account

### Step 1: Login to npm

```bash
# In your x-ray-library directory
npm login
```

You'll be prompted for:
- Username
- Password
- Email
- One-time password (if 2FA is enabled)

### Step 2: Update Package Name (Optional)

If you want to use your npm username as scope:

```bash
# Edit package.json
# Change: "@xray/sdk" to "@YOUR_NPM_USERNAME/xray-sdk"
```

Or keep it as `@xray/sdk` (requires organization/scope ownership)

### Step 3: Test Package Locally

```bash
# Build the package
npm run build

# Check what will be published
npm pack --dry-run

# This shows all files that will be included
```

### Step 4: Publish to npm

```bash
# Publish the package (scoped packages need --access public)
npm publish --access public
```

**Success!** Your package is now live at: `https://www.npmjs.com/package/@xray/sdk`

### Step 5: Verify Publication

```bash
# Check if package is available
npm info @xray/sdk

# Try installing in a test directory
mkdir test-install && cd test-install
npm install @xray/sdk
```

---

## Part 3: Creating a Demo Application in a Separate Repo

### Option A: Create a Simple Node.js Demo

#### Step 1: Create Demo Repository

```bash
# Navigate to your projects directory
cd /Users/durgesh/Desktop/projects

# Create new demo project
mkdir xray-sdk-demo
cd xray-sdk-demo

# Initialize npm project
npm init -y

# Install your published SDK
npm install @xray/sdk

# Install TypeScript and other dependencies
npm install --save-dev typescript @types/node tsx
npm install dotenv openai @prisma/client
```

#### Step 2: Create Demo Files

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

Create `src/basic-example.ts`:
```typescript
import { XRay, MemoryStorage } from '@xray/sdk';

async function demoBasicUsage() {
  console.log('🔍 X-Ray SDK - Basic Demo\n');

  // Initialize XRay with in-memory storage
  const xray = new XRay({
    apiKey: 'demo_key_123',
    storage: new MemoryStorage(),
  });

  // Simulate a multi-step pipeline
  console.log('Starting AI pipeline...');

  xray.startStep('data_preprocessing', {
    rawData: 'user query about weather'
  });
  await sleep(500);
  xray.endStep('data_preprocessing', {
    cleanedData: 'weather query'
  });

  xray.startStep('llm_call', {
    prompt: 'Answer: What is the weather?'
  });
  await sleep(1000);
  xray.endStep('llm_call', {
    response: 'The weather is sunny and 72°F'
  });

  xray.startStep('post_processing', {
    rawResponse: 'sunny 72°F'
  });
  await sleep(300);
  xray.endStep('post_processing', {
    formatted: 'Weather: Sunny, Temperature: 72°F'
  });

  // Finalize execution
  await xray.end({
    success: true,
    finalAnswer: 'Weather: Sunny, Temperature: 72°F'
  });

  // Retrieve and display execution data
  const execution = xray.getExecution();
  console.log('\n📊 Execution Summary:');
  console.log(`Execution ID: ${execution.id}`);
  console.log(`Total Steps: ${execution.steps.length}`);
  console.log(`Duration: ${execution.endTime! - execution.startTime}ms`);
  console.log(`Status: ${execution.status}`);

  console.log('\n📝 Steps:');
  execution.steps.forEach((step, idx) => {
    console.log(`  ${idx + 1}. ${step.name} - ${step.status} (${step.duration}ms)`);
  });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

demoBasicUsage().catch(console.error);
```

Create `src/reasoning-example.ts`:
```typescript
import { XRay, MemoryStorage, ReasoningQueue, OpenAIGenerator } from '@xray/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function demoWithReasoning() {
  console.log('🔍 X-Ray SDK - AI Reasoning Demo\n');

  // Initialize reasoning queue
  const queue = new ReasoningQueue({
    generator: new OpenAIGenerator({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4',
    }),
    concurrency: 2,
    retryAttempts: 3,
  });

  // Initialize XRay
  const xray = new XRay({
    apiKey: 'demo_key_reasoning',
    storage: new MemoryStorage(),
  });

  // Execute a pipeline
  console.log('Starting pipeline with AI reasoning...');

  xray.startStep('query_processing', { query: 'Calculate 2+2' });
  await sleep(200);
  xray.endStep('query_processing', { processed: 'math: 2+2' });

  xray.startStep('calculation', { operation: 'addition' });
  await sleep(300);
  xray.endStep('calculation', { result: 4 });

  await xray.end({ success: true, answer: 4 });

  // Queue AI reasoning (happens asynchronously)
  console.log('Queueing AI reasoning generation...');
  await xray.enqueueReasoning(queue);

  console.log('✅ Reasoning queued! It will process in the background.');
  console.log('   AI will analyze the execution and generate human-readable explanations.\n');

  // Wait for reasoning to complete
  console.log('Waiting for reasoning to complete...');
  await queue.waitUntilIdle();

  // Retrieve execution with reasoning
  const execution = xray.getExecution();
  console.log('\n📊 Execution with AI Reasoning:');
  console.log(`Execution ID: ${execution.id}`);
  console.log(`Reasoning Status: ${execution.reasoning?.status || 'N/A'}`);

  if (execution.reasoning?.data) {
    console.log('\n🤖 AI-Generated Reasoning:');
    console.log(`  Overall: ${execution.reasoning.data.overall}`);
    console.log(`  Next Steps: ${execution.reasoning.data.next_steps}`);

    if (execution.reasoning.data.step_reasoning) {
      console.log('\n  Step-by-Step Reasoning:');
      Object.entries(execution.reasoning.data.step_reasoning).forEach(([step, reason]) => {
        console.log(`    ${step}: ${reason}`);
      });
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

demoWithReasoning().catch(console.error);
```

Create `package.json` scripts:
```json
{
  "name": "xray-sdk-demo",
  "version": "1.0.0",
  "description": "Demo application for @xray/sdk",
  "scripts": {
    "basic": "tsx src/basic-example.ts",
    "reasoning": "tsx src/reasoning-example.ts"
  },
  "keywords": ["xray", "demo", "observability"],
  "author": "Your Name",
  "license": "MIT"
}
```

Create `.env`:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

#### Step 3: Run Demos

```bash
# Run basic demo (no API keys needed)
npm run basic

# Run reasoning demo (requires OpenAI API key)
npm run reasoning
```

#### Step 4: Push Demo to GitHub

```bash
git init
git add .
git commit -m "Initial commit: X-Ray SDK demo application"
git remote add origin https://github.com/YOUR_USERNAME/xray-sdk-demo.git
git push -u origin main
```

---

### Option B: Create a Next.js Demo Application

#### Step 1: Create Next.js App

```bash
# Navigate to projects directory
cd /Users/durgesh/Desktop/projects

# Create Next.js app
npx create-next-app@latest xray-nextjs-demo --typescript --tailwind --app

cd xray-nextjs-demo

# Install X-Ray SDK
npm install @xray/sdk
npm install @prisma/client prisma
```

#### Step 2: Create API Route with X-Ray

Create `app/api/chat/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { XRay, MemoryStorage } from '@xray/sdk';

export async function POST(request: NextRequest) {
  const { message } = await request.json();

  // Initialize XRay for this request
  const xray = new XRay({
    apiKey: 'demo_api_key',
    storage: new MemoryStorage(),
  });

  try {
    // Track message processing
    xray.startStep('input_validation', { message });
    await sleep(100);
    xray.endStep('input_validation', { valid: true });

    // Simulate LLM call
    xray.startStep('llm_processing', { prompt: message });
    await sleep(800);
    const response = `Echo: ${message}`;
    xray.endStep('llm_processing', { response });

    // Track completion
    await xray.end({ success: true, response });

    return NextResponse.json({
      response,
      executionId: xray.getExecution().id,
      steps: xray.getExecution().steps.length,
      duration: xray.getExecution().endTime! - xray.getExecution().startTime,
    });
  } catch (error) {
    xray.errorStep('error', error as Error);
    await xray.end({ success: false, error: String(error) });

    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

Create `app/page.tsx`:
```typescript
'use client';

import { useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">X-Ray SDK Demo</h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter a message..."
          className="w-full p-3 border rounded mb-4"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Send Message'}
        </button>
      </form>

      {result && (
        <div className="bg-gray-100 p-6 rounded">
          <h2 className="text-xl font-semibold mb-4">Execution Result</h2>
          <div className="space-y-2">
            <p><strong>Response:</strong> {result.response}</p>
            <p><strong>Execution ID:</strong> {result.executionId}</p>
            <p><strong>Steps:</strong> {result.steps}</p>
            <p><strong>Duration:</strong> {result.duration}ms</p>
          </div>
        </div>
      )}
    </main>
  );
}
```

#### Step 3: Run Next.js Demo

```bash
npm run dev
```

Visit `http://localhost:3000` to see the demo.

---

## Part 4: Updating Your Published Package

When you make changes to the library:

```bash
# 1. Make your changes in x-ray-library

# 2. Rebuild
npm run build

# 3. Update version (patch/minor/major)
npm version patch

# 4. Push to GitHub
git push --follow-tags

# 5. Republish to npm
npm publish --access public
```

---

## Part 5: Best Practices

### Version Management
- **Patch** (0.1.0 → 0.1.1): Bug fixes
- **Minor** (0.1.0 → 0.2.0): New features (backward compatible)
- **Major** (0.1.0 → 1.0.0): Breaking changes

### Documentation
- Keep README.md updated in the library repo
- Add CHANGELOG.md to track version changes
- Update examples when API changes

### Testing Before Publishing
```bash
# Test locally before publishing
npm link

# In demo project
npm link @xray/sdk

# Test everything works, then unlink
npm unlink @xray/sdk
```

---

## Summary

✅ **Step 1:** Push library to separate GitHub repo
✅ **Step 2:** Publish to npm with `npm publish`
✅ **Step 3:** Create demo app in new repo
✅ **Step 4:** Install SDK with `npm install @xray/sdk`
✅ **Step 5:** Build demo using the published SDK

Your library is now publicly available and can be used by anyone!

---

## Useful Links

- **npm Package:** `https://www.npmjs.com/package/@xray/sdk`
- **GitHub Library:** `https://github.com/YOUR_USERNAME/xray-sdk`
- **GitHub Demo:** `https://github.com/YOUR_USERNAME/xray-sdk-demo`

For questions or issues, open a GitHub issue in the library repository.
