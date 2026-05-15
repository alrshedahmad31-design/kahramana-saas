import { createClient } from '@/lib/supabase/server'
import type { CustomerProfileRow } from '@/lib/supabase/custom-types'

export async function getCustomerSession(): Promise<CustomerProfileRow | null> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    // A user is a "customer" if they have a customer_profile row
    // (staff users will not have one)
    // maybeSingle: staff users have no customer_profile row → returns null
    // instead of throwing PGRST116 (which the catch was swallowing silently).
    const { data } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    return (data as CustomerProfileRow | null)
  } catch {
    return null
  }
}
