import { redirect } from 'next/navigation'
import { BRANCH_LIST } from '@/constants/contact'
import {
  isDashboardGuardError,
  isGlobalDashboardAdmin,
  requireDashboardSection,
} from '@/lib/auth/dashboard-guards'
import { getWaitlist } from './actions'
import WaitlistClient from './WaitlistClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string }>
}

export default async function WaitlistPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const search = await searchParams
  const prefix = locale === 'en' ? '/en' : ''

  let user
  try {
    user = await requireDashboardSection('waitlist')
  } catch (error) {
    if (isDashboardGuardError(error) && error.code === 'unauthorized') redirect(`${prefix}/login`)
    redirect(`${prefix}/dashboard`)
  }

  const isGlobalAdmin = isGlobalDashboardAdmin(user)
  const branchOptions = BRANCH_LIST.filter((branch) => branch.status === 'active')
  const requestedBranch = search.branch ?? branchOptions[0]?.id ?? ''
  const branchId = isGlobalAdmin ? requestedBranch : (user.branch_id ?? '')

  if (!branchId) redirect(`${prefix}/dashboard`)

  const entries = await getWaitlist(branchId)

  return (
    <WaitlistClient
      initialEntries={entries}
      branchId={branchId}
      branches={branchOptions.map((branch) => ({
        id:     branch.id,
        nameAr: branch.nameAr,
        nameEn: branch.nameEn,
      }))}
      isGlobalAdmin={isGlobalAdmin}
      locale={locale === 'en' ? 'en' : 'ar'}
    />
  )
}
