import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageCoupons } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import type { CouponRow, BranchRow } from '@/lib/supabase/custom-types'
import CouponsClient from './CouponsClient'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function CouponsPage({ params }: Props) {
  const { locale } = await params
  const user = await getSession()
  if (!user) redirect(`/${locale}/login`)
  if (!canManageCoupons(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  const supabase = await createClient()
  
  const { getActiveBranches } = await import('@/lib/branches/queries')
  const [couponsRes, branches] = await Promise.all([
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    getActiveBranches()
  ])

  const coupons = (couponsRes.data ?? []) as CouponRow[]

  return <CouponsClient coupons={coupons} branches={branches as unknown as BranchRow[]} />
}
