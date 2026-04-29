import { requireAuth } from '@/lib/auth/session'
import ScheduleClient from '@/components/schedule/ScheduleClient'

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await requireAuth()
  return <ScheduleClient locale={locale} userRole={user.role} />
}
