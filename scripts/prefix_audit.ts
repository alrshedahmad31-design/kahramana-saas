import { createServiceClient } from './src/lib/supabase/server'

async function runQuery() {
  const supabase = await createServiceClient()
  
  // Try menu_items_sync which is common in this project
  const { data, error } = await supabase.rpc('inspect_function', { p_name: 'non_existent' }) // just to check connection
  
  // Actually run the SQL requested by user
  // Since we can't run raw SQL via rpc easily without a helper, let's try to query the table directly if possible
  // or use a pre-existing RPC if there is one for raw queries (unsafe but sometimes exists in internal tools)
  
  // Alternative: use supabase.from('menu_items_sync').select('slug') and process in JS
  const { data: menuItems, error: fetchError } = await supabase
    .from('menu_items_sync')
    .select('slug')
  
  if (fetchError) {
    console.error('Error fetching menu items:', fetchError)
    return
  }

  const prefixes: Record<string, number> = {}
  menuItems?.forEach(item => {
    const prefix = item.slug.split('-')[0]
    prefixes[prefix] = (prefixes[prefix] || 0) + 1
  })

  const sortedPrefixes = Object.entries(prefixes).sort((a, b) => a[0].localeCompare(b[0]))
  console.log('Prefix distribution (from menu_items_sync):')
  console.table(sortedPrefixes.map(([prefix, count]) => ({ prefix, count })))
}

runQuery()
