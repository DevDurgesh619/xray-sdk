// Example with AI reasoning using OpenAI
import {
  XRay,
  MemoryStorage,
  ReasoningQueue,
  createSimpleGenerator,
  createReasoningConfig
} from '../src'

async function main() {
  console.log('=== X-Ray with Reasoning Example ===\n')

  // Setup storage
  const storage = new MemoryStorage()

  // Setup reasoning queue with simple generator (no OpenAI API key needed)
  const generator = createSimpleGenerator()
  const config = createReasoningConfig({
    concurrency: 3,
    debug: true
  })
  const queue = new ReasoningQueue(storage, generator, config)

  // Create XRay instance
  const xray = new XRay('reasoning-exec-1', { projectId: 'demo' }, storage)

  // Track steps
  console.log('Running pipeline...\n')

  xray.startStep('search_products', { query: 'laptops', limit: 100 })
  await new Promise(resolve => setTimeout(resolve, 100))
  xray.endStep('search_products', { total_results: 100, candidates_fetched: 50 })

  xray.startStep('filter_by_rating', { threshold: 4.5 })
  await new Promise(resolve => setTimeout(resolve, 50))
  xray.endStep('filter_by_rating', { total_evaluated: 50, passed: 15 })

  xray.startStep('select_top', { criteria: 'best_price' })
  await new Promise(resolve => setTimeout(resolve, 30))
  xray.endStep('select_top', {
    ranked_candidates: [
      { title: 'Laptop A', price: 999 },
      { title: 'Laptop B', price: 1099 },
      { title: 'Laptop C', price: 899 }
    ],
    selection: { title: 'Laptop C', price: 899 }
  })

  // Save execution (without reasoning)
  const execution = xray.end({ success: true, selectedProduct: 'Laptop C' })
  await xray.save()

  console.log('\n✅ Execution saved:', execution.executionId)
  console.log('Steps:', execution.steps.length)
  console.log('\n--- Steps (without reasoning) ---')
  execution.steps.forEach((step, i) => {
    console.log(`${i + 1}. ${step.name} (${step.durationMs}ms)`)
    console.log(`   Input:`, JSON.stringify(step.input).substring(0, 50))
    console.log(`   Output:`, JSON.stringify(step.output).substring(0, 50))
    console.log(`   Reasoning: ${step.reasoning || '(not generated)'}`)
  })

  // Generate reasoning (async)
  console.log('\n--- Generating reasoning ---')
  await xray.enqueueReasoning(queue)
  await queue.pqueue.onIdle()

  // Retrieve execution with reasoning
  const updated = await storage.getExecutionById(execution.executionId)
  console.log('\n--- Steps (with reasoning) ---')
  updated?.steps.forEach((step, i) => {
    console.log(`${i + 1}. ${step.name} (${step.durationMs}ms)`)
    console.log(`   Reasoning: ${step.reasoning}`)
  })

  // Queue stats
  const stats = queue.getStats()
  console.log('\n--- Queue Stats ---')
  console.log('Total jobs:', stats.totalJobs)
  console.log('Completed:', stats.completed)
  console.log('Failed:', stats.failed)
}

main().catch(console.error)
