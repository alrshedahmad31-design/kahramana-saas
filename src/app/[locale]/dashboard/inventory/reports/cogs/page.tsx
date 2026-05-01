import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import COGSClient from './COGSClient'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function COGSPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const supabase = await createClient()
  const { data: dishes } = await supabase
    .from('v_dish_cogs')
    .select('*')
    .order('margin_pct', { ascending: true })

  // Cast: Supabase infers nullable columns; DishCogsRow expects non-null slug
  const safeData = (dishes ?? []) as import('@/lib/supabase/custom-types').DishCogsRow[]

  return (
    <div className="space-y-6">
      <ReportHeader
        title={isAr ? 'تكلفة الأصناف (COGS)' : 'Dish COGS Report'}
        description={isAr ? 'هامش الربح والتكلفة لكل طبق في القائمة' : 'Profit margin and cost for every menu item'}
        locale={locale}
      />
      {safeData.length === 0 ? (
        <EmptyReport
          title={isAr ? 'لا توجد بيانات' : 'No data'}
          description={isAr ? 'لم يتم العثور على وصفات مرتبطة بأسعار' : 'No recipes with pricing found'}
        />
      ) : (
        <COGSClient dishes={safeData} isAr={isAr} />
      )}
    </div>
  )
}
