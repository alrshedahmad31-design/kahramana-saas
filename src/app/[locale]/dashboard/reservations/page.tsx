import { redirect } from 'next/navigation'
import { BRANCH_LIST } from '@/constants/contact'
import {
  isDashboardGuardError,
  isGlobalDashboardAdmin,
  requireDashboardSection,
} from '@/lib/auth/dashboard-guards'
import ReservationsClient from '@/components/dashboard/reservations/ReservationsClient'
import { getReservations } from './actions'

export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string }>
}

export default async function ReservationsPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const search = await searchParams
  const prefix = locale === 'en' ? '/en' : ''

  let user
  try {
    user = await requireDashboardSection('reservations')
  } catch (error) {
    if (isDashboardGuardError(error) && error.code === 'unauthorized') redirect(`${prefix}/login`)
    redirect(`${prefix}/dashboard`)
  }

  const isGlobalAdmin = isGlobalDashboardAdmin(user)
  const branchOptions = BRANCH_LIST.filter((branch) => branch.status === 'active')
  const requestedBranch = search.branch ?? branchOptions[0]?.id ?? ''
  const branchId = isGlobalAdmin ? requestedBranch : (user.branch_id ?? '')

  if (!branchId) redirect(`${prefix}/dashboard`)

  const reservations = await getReservations(branchId)

  return (
    <ReservationsClient
      initialReservations={reservations}
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
