const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

async function checkKDSAssignments() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  
  const { data: oiss, error } = await supabase
    .from('order_item_station_status')
    .select('station, item_id')
    .limit(100)
    
  if (error) {
    console.error(error)
    return
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('id, menu_item_slug, name_ar')
    .in('id', oiss.map(o => o.item_id))

  const results = oiss.map(o => {
    const item = items.find(i => i.id === o.item_id)
    return {
      station: o.station,
      slug: item?.menu_item_slug,
      name: item?.name_ar
    }
  })

  console.table(results.filter(r => r.station === 'grill'))
}

checkKDSAssignments()
