import { redirect }         from 'next/navigation'
import { requireAuth }       from '@/lib/auth/session'
import { canManageSettings } from '@/lib/auth/rbac'
import SettingsClient        from '@/components/settings/SettingsClient'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user       = await requireAuth()

  if (!canManageSettings(user)) {
    redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')
  }

  return <SettingsClient userRole={user.role} />
}
