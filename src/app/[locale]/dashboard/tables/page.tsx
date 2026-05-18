import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireDashboardSection, isDashboardGuardError } from '@/lib/auth/dashboard-guards'
import { BRANCH_LIST, SITE_URL } from '@/constants/contact'
import TablesClient, { type TableRow } from './TablesClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string }>
}

export default async function TablesPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const search = await searchParams
  const prefix = locale === 'en' ? '/en' : ''
  const t = await getTranslations({ locale, namespace: 'tablesAdmin' })

  let user
  try {
    user = await requireDashboardSection('tables')
  } catch (e) {
    if (isDashboardGuardError(e) && e.code === 'unauthorized') redirect(`${prefix}/login`)
    redirect(`${prefix}/dashboard`)
  }

  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  const branchOptions = BRANCH_LIST.filter((b) => b.status === 'active')
  const branchId = isGlobalAdmin
    ? (search.branch ?? branchOptions[0]?.id ?? '')
    : (user.branch_id ?? '')

  const supabase = await createServiceClient()

  const { data: rawTables } = await supabase
    .from('restaurant_tables')
    .select('id, branch_id, table_number, label_ar, label_en, capacity, is_active')
    .eq('branch_id', branchId)
    .order('table_number', { ascending: true })

  const tables = (rawTables ?? []) as TableRow[]

  return (
    <TablesClient
      tables={tables}
      branchId={branchId}
      branches={branchOptions.map((b) => ({ id: b.id, nameAr: b.nameAr, nameEn: b.nameEn }))}
      isGlobalAdmin={isGlobalAdmin}
      siteUrl={SITE_URL}
      locale={locale === 'en' ? 'en' : 'ar'}
      messages={{
        title:       t('title'),
        subtitle:    t('subtitle'),
        downloadQr:  t('downloadQr'),
        downloadAll: t('downloadAll'),
        empty:       t('empty'),
        inactive:    t('inactive'),
      }}
    />
  )
}
