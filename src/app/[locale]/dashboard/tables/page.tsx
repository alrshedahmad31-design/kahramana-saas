import { redirect } from 'next/navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) redirect(`${prefix}/dashboard`)

  const supabase = createSupabaseClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

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
    />
  )
}
