import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function runAudit() {
  console.log('--- KDS Station Distribution ---')
  
  const { data: rawData, error: error2 } = await supabase
    .from('order_item_station_status')
    .select('station')

  if (error2) {
    console.error('Error fetching station data:', error2)
  } else {
    const counts = rawData.reduce((acc: any, row: any) => {
      acc[row.station] = (acc[row.station] || 0) + 1
      return acc
    }, {})
    console.table(counts)
  }

  console.log('\n--- Unassigned Items (Last 20) ---')
  const { data: unassigned, error: error3 } = await supabase
    .from('order_item_station_status')
    .select(`
      station,
      order_items (
        name_ar,
        name_en,
        menu_item_slug
      )
    `)
    .eq('station', 'unassigned')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error3) {
    console.error('Error fetching unassigned items:', error3)
  } else {
    const formatted = unassigned.map((row: any) => ({
      name: row.order_items?.name_ar || 'UNKNOWN',
      slug: row.order_items?.menu_item_slug || 'UNKNOWN',
      station: row.station
    }))
    console.table(formatted)
  }
}

runAudit()
