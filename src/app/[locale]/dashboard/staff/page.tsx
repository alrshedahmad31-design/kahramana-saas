import { getTranslations } from 'next-intl/server'
import { redirect }        from 'next/navigation'
import { getSession }      from '@/lib/auth/session'
import { canAccessStaffPage, canManageStaff } from '@/lib/auth/rbac'
import { createClient }    from '@/lib/supabase/server'
import type { StaffBasicRow, StaffExtendedRow } from '@/lib/supabase/types'
import StaffViewManager    from '@/components/staff/StaffViewManager'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function StaffPage({ params }: Props) {
  const { locale } = await params

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')

  if (!canAccessStaffPage(user)) {
    redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')
  }

  const t = await getTranslations('dashboard.staff')

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staff } = await (supabase as any)
    .from('staff_basic')
    .select(`
      id, name, role, branch_id, is_active, created_at,
      phone, hire_date, employment_type, hourly_rate,
      emergency_contact_name, emergency_contact_phone,
      id_number, date_of_birth, address, profile_photo_url,
      staff_notes, clock_pin
    `)
    .order('created_at', { ascending: false })

  const rows = (staff ?? []) as StaffExtendedRow[]

  const manageable = new Set(
    rows.filter((s) => canManageStaff(user, s as unknown as StaffBasicRow)).map((s) => s.id),
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-satoshi font-black text-2xl text-brand-text">
          {t('title')}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-0.5">
          {rows.length} {rows.length === 1 ? 'member' : 'members'}
        </p>
      </div>

      <StaffViewManager
        rows={rows}
        manageableIds={Array.from(manageable)}
        callerRole={user.role}
        callerBranchId={user.branch_id}
        locale={locale}
      />
    </div>
  )
}
