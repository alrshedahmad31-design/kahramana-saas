import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canAccessReports } from '@/lib/auth/rbac'
import ReportsClient from './ReportsClient'

interface Props {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

export const dynamic = 'force-dynamic'

export default async function ReportsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp         = await searchParams

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessReports(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  return (
    <ReportsClient
      locale={locale}
      initialRange={sp.range ?? '30d'}
      initialFrom={sp.from}
      initialTo={sp.to}
    />
  )
}
