import { createServiceClient } from './src/lib/supabase/server'

async function checkRpc() {
  const supabase = await createServiceClient()
  
  // Check if bump_station_order exists and its arguments
  const { data, error } = await supabase.rpc('inspect_function', { p_name: 'bump_station_order' })
  
  if (error) {
    console.error('Error calling inspect_function:', error)
    // Fallback: try to just call it with dummy data to see the error message
    const { error: callError } = await supabase.rpc('bump_station_order', { 
      p_order_id: '00000000-0000-0000-0000-000000000000',
      p_station: 'grill'
    })
    console.log('Call error (expected if missing or invalid args):', callError)
  } else {
    console.log('Function info:', data)
  }
}

checkRpc()
