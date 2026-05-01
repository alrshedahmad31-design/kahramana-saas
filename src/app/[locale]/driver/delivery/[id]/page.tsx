// This detail page predated the current driver dashboard and used a stale
// status enum (ready_for_pickup / picked_up / en_route) that no longer
// matches the DB schema. It also performed client-side select('*') and
// update() with no server-side authorization.
//
// The current driver flow is fully handled by /[locale]/driver.
// Redirect here unconditionally so any bookmarked deep-links still land safely.

import { redirect }        from 'next/navigation'
import { getSession }      from '@/lib/auth/session'
import { canAccessDriver } from '@/lib/auth/rbac'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export default async function DriverDeliveryDetailPage({ params }: Props) {
  const { locale } = await params
  const user = await getSession()

  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessDriver(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  redirect(locale === 'en' ? '/en/driver' : '/driver')
}
