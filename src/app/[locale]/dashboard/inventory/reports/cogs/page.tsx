import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
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
  const t = await getTranslations({ locale, namespace: 'inventory.reports.cogs' })
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
        title={t('title')}
        description={t('desc')}
        locale={locale}
      />
      {safeData.length === 0 ? (
        <EmptyReport
          title={t('emptyTitle')}
          description={t('emptyDesc')}
        />
      ) : (
        <COGSClient dishes={safeData} locale={locale} />
      )}
    </div>
  )
}

