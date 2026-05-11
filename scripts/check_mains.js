const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

async function checkMains() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data } = await supabase.from('menu_items_sync').select('slug, name_ar')
  const matches = data.filter(item => item.slug.startsWith('mains-'))
  console.table(matches)
}

checkMains()
