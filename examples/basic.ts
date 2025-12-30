// Basic usage example - In-memory storage, no reasoning
import { XRay, MemoryStorage } from '../src'

async function main() {
  console.log('=== X-Ray Basic Example ===\n')

  // Create in-memory storage
  const storage = new MemoryStorage()

  // Create XRay instance
  const xray = new XRay('basic-exec-1', { projectId: 'demo' }, storage)

  // Track step 1: Fetch data
  console.log('Step 1: Fetching data...')
  xray.startStep('fetch_data', { query: 'laptops', limit: 10 })
  await new Promise(resolve => setTimeout(resolve, 100)) // Simulate API call
  const data = ['laptop1', 'laptop2', 'laptop3']
  xray.endStep('fetch_data', { count: data.length, items: data })
  console.log(`✓ Fetched ${data.length} items\n`)

  // Track step 2: Process data
  console.log('Step 2: Processing data...')
  xray.startStep('process_data', { items: data })
  await new Promise(resolve => setTimeout(resolve, 50))
  const processed = data.map(item => item.toUpperCase())
  xray.endStep('process_data', { processed: processed.length })
  console.log(`✓ Processed ${processed.length} items\n`)

  // Track step 3: Save results
  console.log('Step 3: Saving results...')
  xray.startStep('save_results', { count: processed.length })
  await new Promise(resolve => setTimeout(resolve, 30))
  xray.endStep('save_results', { success: true })
  console.log('✓ Results saved\n')

  // End execution
  const execution = xray.end({ totalProcessed: processed.length })
  await xray.save()

  console.log('=== Execution Complete ===')
  console.log('Execution ID:', execution.executionId)
  console.log('Total Steps:', execution.steps.length)
  console.log('Duration:',
    new Date(execution.endedAt!).getTime() - new Date(execution.startedAt).getTime(),
    'ms'
  )

  // Retrieve execution from storage
  const retrieved = await storage.getExecutionById(execution.executionId)
  console.log('\nRetrieved from storage:', retrieved?.executionId)
  console.log('Steps:', retrieved?.steps.map(s => s.name).join(' → '))
}

main().catch(console.error)
