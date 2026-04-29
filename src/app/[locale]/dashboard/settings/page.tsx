import { requireAuth }  from '@/lib/auth/session'
import SettingsClient  from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const user = await requireAuth()
  return <SettingsClient userRole={user.role} />
}
