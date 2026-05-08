#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const { data: rows, error: e1 } = await supabase
    .from('menu_items_sync')
    .select('station')
  if (e1) throw e1

  const dist: Record<string, number> = {}
  let nullCount = 0
  for (const r of rows ?? []) {
    if (r.station == null) nullCount++
    else dist[r.station] = (dist[r.station] ?? 0) + 1
  }

  console.log('\n── Station distribution (live DB) ──')
  for (const [s, c] of Object.entries(dist).sort()) {
    console.log(`  ${s.padEnd(20)} ${c}`)
  }
  console.log(`  ${'(NULL)'.padEnd(20)} ${nullCount}`)
  console.log(`  ${'TOTAL'.padEnd(20)} ${(rows ?? []).length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
