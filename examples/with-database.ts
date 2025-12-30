// Example with database storage (Prisma)
// NOTE: This requires a Prisma setup with the XRay schema

/**
 * Setup instructions:
 *
 * 1. Install dependencies:
 *    npm install @prisma/client
 *
 * 2. Add schema to prisma/schema.prisma:
 *    See README.md for schema definition
 *
 * 3. Run migrations:
 *    npx prisma migrate dev --name add_xray
 *    npx prisma generate
 *
 * 4. Set DATABASE_URL in .env:
 *    DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
 *
 * 5. Run this example:
 *    ts-node examples/with-database.ts
 */

import { XRay, DatabaseStorage } from '../src'
// import { PrismaClient } from '@prisma/client'

async function main() {
  console.log('=== X-Ray with Database Example ===\n')

  // Uncomment when Prisma is set up:
  /*
  const prisma = new PrismaClient()
  const storage = new DatabaseStorage(prisma)

  const xray = new XRay('db-exec-1', { projectId: 'demo' }, storage)

  // Track steps
  xray.startStep('step1', { input: 'data' })
  await new Promise(resolve => setTimeout(resolve, 100))
  xray.endStep('step1', { output: 'result' })

  xray.startStep('step2', { input: 'result' })
  await new Promise(resolve => setTimeout(resolve, 50))
  xray.endStep('step2', { output: 'final' })

  // Save to database
  const execution = xray.end({ success: true })
  await xray.save()

  console.log('✅ Execution saved to database:', execution.executionId)

  // Retrieve from database
  const retrieved = await storage.getExecutionById(execution.executionId)
  console.log('✅ Retrieved from database:', retrieved?.executionId)
  console.log('Steps:', retrieved?.steps.map(s => s.name).join(' → '))

  // Get all executions
  const allExecutions = await storage.getAllExecutions()
  console.log(`\nTotal executions in database: ${allExecutions.length}`)

  await prisma.$disconnect()
  */

  console.log('\n⚠️  This example requires Prisma setup.')
  console.log('See comments at the top of this file for instructions.')
}

main().catch(console.error)
