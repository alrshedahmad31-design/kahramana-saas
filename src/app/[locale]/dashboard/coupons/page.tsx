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
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canManageCoupons(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  const supabase = await createClient()
  
  const [couponsRes, branchesRes] = await Promise.all([
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    supabase.from('branches').select('*').order('name_en')
  ])

  const coupons = (couponsRes.data ?? []) as CouponRow[]
  const branches = (branchesRes.data ?? []) as BranchRow[]

  return <CouponsClient coupons={coupons} branches={branches} />
}
