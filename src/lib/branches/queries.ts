import { createServiceClient } from '@/lib/supabase/server'
import { isHiddenBranch } from '@/constants/contact'

/**
 * Fetches active branches from the database and filters out those listed in HIDDEN_BRANCHES.
 * This is the recommended way to fetch branch lists for dashboard dropdowns and selectors.
 */
export async function getActiveBranches() {
  const supabase = await createServiceClient()
  
  const { data, error } = await supabase
    .from('branches')
    .select('id, name_ar, name_en, is_active')
    .eq('is_active', true)
    .order('name_ar')

  if (error) {
    console.error('[queries] getActiveBranches failed:', error)
    return []
  }

  return (data ?? []).filter((branch) => !isHiddenBranch(branch.id))
}
