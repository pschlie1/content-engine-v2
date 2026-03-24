import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { db } from './client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function migrate(): Promise<void> {
  console.log('Running database migration...')

  const schemaPath = join(__dirname, 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf-8')

  // Split on semicolons but handle multi-line statements
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    try {
      await db.execute(statement)
    } catch (err) {
      console.error(`Failed to execute statement: ${statement.substring(0, 100)}...`)
      throw err
    }
  }

  console.log(`Migration complete. Ran ${statements.length} statements.`)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
