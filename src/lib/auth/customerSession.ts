import { createClient } from '@/lib/supabase/server'
import type { CustomerProfileRow } from '@/lib/supabase/types'

export async function getCustomerSession(): Promise<CustomerProfileRow | null> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    // A user is a "customer" if they have a customer_profile row
    // (staff users will not have one)
    const { data } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return (data as CustomerProfileRow | null)
  } catch {
    return null
  }
}
