import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageCoupons } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { getActiveBranches } from '@/lib/branches/queries'
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

  let couponsQuery = supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  // Branch managers must only see coupons scoped to their own branch
  // (applicable_branches contains their branch_id) or that they own.
  // Owner / GM / marketing keep cross-branch visibility for now (marketing
  // write-scope is enforced separately in assertCouponScope).
  if (user.role === 'branch_manager' && user.branch_id) {
    couponsQuery = couponsQuery.or(
      `applicable_branches.cs.{${user.branch_id}},created_by.eq.${user.id}`,
    )
  }

  const [couponsRes, branches] = await Promise.all([
    couponsQuery,
    getActiveBranches(),
  ])

  const coupons = (couponsRes.data ?? []) as CouponRow[]

  return <CouponsClient coupons={coupons} branches={branches as unknown as BranchRow[]} />
}
