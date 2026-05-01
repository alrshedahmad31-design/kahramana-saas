import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
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
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const supabase = await createClient()

  const [{ data: rawRows }, { data: branches }] = await Promise.all([
    supabase.from('mv_variance_report').select('*').order('variance_cost_bhd', { ascending: false }),
    supabase.from('branches').select('id, name_ar').eq('is_active', true),
  ])

  // Cast materialized view result to our inline VarianceRow type
  type VarianceRow = {
    ingredient_id: string; name_ar: string; name_en: string
    abc_class: string; branch_id: string
    theoretical_usage: number; actual_usage: number
    variance: number; variance_pct: number | null; variance_cost_bhd: number
  }
  const rows = (rawRows ?? []) as VarianceRow[]

  return (
    <div className="space-y-6">
      <ReportHeader
        title={isAr ? 'تقرير التباين' : 'Variance Report'}
        description={isAr ? 'الفرق بين الاستهلاك الفعلي والنظري — التحديث التلقائي كل ساعة' : 'Actual vs theoretical usage — auto-refreshed hourly'}
        locale={locale}
      />
      {!rows || rows.length === 0 ? (
        <EmptyReport
          title={isAr ? 'لا توجد بيانات تباين' : 'No variance data'}
          description={isAr ? 'لم يتم تسجيل أي استهلاك حتى الآن' : 'No consumption recorded yet'}
        />
      ) : (
        <VarianceClient
          rows={rows}
          branches={branches ?? []}
          isAr={isAr}
          isGlobal={isGlobal}
        />
      )}
    </div>
  )
}
