import { getTranslations } from 'next-intl/server'
import { redirect }        from 'next/navigation'
import { getSession }      from '@/lib/auth/session'
import { canAccessStaffPage, canManageStaff } from '@/lib/auth/rbac'
import { createClient }    from '@/lib/supabase/server'
import type { StaffExtendedRow } from '@/lib/supabase/custom-types'
import StaffViewManager    from '@/components/staff/StaffViewManager'
import { resolveStaffPhotoSignedUrl } from '@/lib/storage/staff-photos'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function StaffPage({ params }: Props) {
  const { locale } = await params

  const user = await getSession()
  if (!user) redirect(`/${locale}/login`)

  if (!canAccessStaffPage(user)) {
    redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')
  }

  const t = await getTranslations('dashboard.staff')

  const supabase = await createClient()
  let staffQuery = supabase
    .from('staff_basic')
    .select('*')
    .order('created_at', { ascending: false })

  // Branch managers must only see staff in their own branch. canManageStaff
  // already filters which rows are mutable, but the read query itself must
  // not leak names / emails / roles from other branches (P0-8).
  if (user.role === 'branch_manager' && user.branch_id) {
    staffQuery = staffQuery.eq('branch_id', user.branch_id)
  }

  const { data: staff } = await staffQuery

  // VULN-010: staff-photos is now a private bucket. Resolve each row's photo
  // to a short-lived signed URL on the server so client components never
  // depend on getPublicUrl. extractStaffPhotoPath handles legacy rows that
  // still hold full public URLs written before the bucket was made private.
  const rawRows: StaffExtendedRow[] = staff ?? []
  const rows: StaffExtendedRow[] = await Promise.all(
    rawRows.map(async (row) => {
      if (!row.profile_photo_url) return row
      const signed = await resolveStaffPhotoSignedUrl(row.profile_photo_url)
      return { ...row, profile_photo_url: signed }
    }),
  )

  const manageable = new Set(
    rows.filter((s) => canManageStaff(user, s)).map((s) => s.id),
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
