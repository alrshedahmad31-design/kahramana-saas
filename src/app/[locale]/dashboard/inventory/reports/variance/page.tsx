import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getActiveBranches } from '@/lib/branches/queries'
import { isHiddenBranch } from '@/constants/contact'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import VarianceClient from './VarianceClient'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function VariancePage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'inventory.reports.variance' })
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const supabase = await createClient()

  const [{ data: rawRows }, branches] = await Promise.all([
    supabase.from('mv_variance_report').select('*').order('variance_cost_bhd', { ascending: false }),
    getActiveBranches(),
  ])

  // Cast materialized view result to our inline VarianceRow type
  type VarianceRow = {
    ingredient_id: string; name_ar: string; name_en: string
    abc_class: string; branch_id: string
    theoretical_usage: number; actual_usage: number
    variance: number; variance_pct: number | null; variance_cost_bhd: number
  }
  const allRows = (rawRows ?? []) as VarianceRow[]
  // Filter out hidden branches from the data
  const rows = allRows.filter((r) => !isHiddenBranch(r.branch_id))

  return (
    <div className="space-y-6">
      <ReportHeader
        title={t('title')}
        description={t('desc')}
      />
      {!rows || rows.length === 0 ? (
        <EmptyReport
          title={t('emptyTitle')}
          description={t('emptyDesc')}
        />
      ) : (
        <VarianceClient
          rows={rows}
          branches={branches ?? []}
          locale={locale}
          isGlobal={isGlobal}
        />
      )}
    </div>
  )
}

