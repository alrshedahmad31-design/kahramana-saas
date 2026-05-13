import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { requireDashboardSection, isDashboardGuardError } from '@/lib/auth/dashboard-guards'
import { BRANCH_LIST } from '@/constants/contact'
import PromotionsClient from './PromotionsClient'
import type { PromotionRow } from '@/lib/promotions/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function PromotionsPage({ params }: PageProps) {
  const { locale } = await params
  const prefix = locale === 'en' ? '/en' : ''

  let user
  try {
    user = await requireDashboardSection('promotions')
  } catch (e) {
    if (isDashboardGuardError(e) && e.code === 'unauthorized') redirect(`${prefix}/login`)
    redirect(`${prefix}/dashboard`)
  }

  const supabase = createServiceClient()

  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  let query = supabase
    .from('promotions')
    .select('id, branch_id, name_ar, name_en, type, config, starts_at, ends_at, is_active, max_uses, use_count, created_at')
    .order('created_at', { ascending: false })

  // branch_manager / marketing see their own branch + globals.
  if (!isGlobalAdmin && user.branch_id) {
    query = query.or(`branch_id.is.null,branch_id.eq.${user.branch_id}`)
  }

  const { data } = await query
  const promotions = (data ?? []) as PromotionRow[]

  const branches = BRANCH_LIST
    .filter((b) => b.status === 'active')
    .map((b) => ({ id: b.id, nameAr: b.nameAr, nameEn: b.nameEn }))

  return (
    <PromotionsClient
      initialPromotions={promotions}
      branches={branches}
      isGlobalAdmin={isGlobalAdmin}
      callerBranchId={user.branch_id ?? null}
      locale={locale === 'en' ? 'en' : 'ar'}
    />
  )
}
