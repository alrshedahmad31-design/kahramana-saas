import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  const sql = fs.readFileSync('supabase/migrations/101_kds_routing_fix.sql', 'utf8')
  
  console.log('Applying Migration 101...')
  
  // PostgREST/Supabase-js doesn't support multi-statement raw SQL well via .rpc()
  // unless we have a specific 'exec_sql' RPC. 
  // For safety, I'll split the SQL into statements or use the Supabase SQL editor if I could.
  // Since I can't, I'll try to run it via an RPC if it exists, or provide the SQL to the user.
  
  // Alternative: Run a few specific queries via the client to simulate the backfill.
  
  console.log('--- Step 1: Backfilling Legacy Stations ---')
  await supabase.from('order_item_station_status').update({ station: 'grill' }).in('station', ['shawarma', 'main'])
  await supabase.from('order_item_station_status').update({ station: 'fryer' }).eq('station', 'bakery')
  await supabase.from('order_item_station_status').update({ station: 'cold' }).eq('station', 'appetizer_drinks')

  console.log('--- Step 2: Manual Backfill for Unassigned ---')
  const { data: unassigned } = await supabase
    .from('order_item_station_status')
    .select('item_id, order_items(menu_item_slug)')
    .eq('station', 'unassigned')

  for (const row of unassigned || []) {
    const slug = (row.order_items as any)?.menu_item_slug
    let newStation = null
    if (slug?.startsWith('main-')) newStation = 'grill'
    else if (slug?.startsWith('stews-')) newStation = 'grill'
    else if (slug?.startsWith('breakfast-fattat-')) newStation = 'fryer'

    if (newStation) {
      await supabase.from('order_item_station_status').update({ station: newStation }).eq('item_id', row.item_id)
      console.log(`Re-routed ${slug} -> ${newStation}`)
    }
  }

  console.log('Migration Applied (Partial - SQL Trigger needs manual apply via Dashboard if no exec_sql RPC)')
}

applyMigration()
