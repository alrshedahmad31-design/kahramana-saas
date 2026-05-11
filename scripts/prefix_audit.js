const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

async function runQuery() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    console.error('Missing Supabase URL or Key in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  
  const { data: menuItems, error: fetchError } = await supabase
    .from('menu_items_sync')
    .select('slug')
  
  if (fetchError) {
    console.error('Error fetching menu items:', fetchError)
    return
  }

  const prefixes = {}
  menuItems?.forEach(item => {
    if (!item.slug) return
    const prefix = item.slug.split('-')[0]
    prefixes[prefix] = (prefixes[prefix] || 0) + 1
  })

  const sortedPrefixes = Object.entries(prefixes).sort((a, b) => a[0].localeCompare(b[0]))
  console.log('Prefix distribution (from menu_items_sync):')
  sortedPrefixes.forEach(([prefix, count]) => {
    console.log(`${prefix}: ${count}`)
  })
}

runQuery()
