import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { STATION_CONFIG } from '@/constants/kds'
import { Icon } from '@/components/ui/Icon'
import type { KDSStation } from '@/lib/supabase/custom-types'

interface Props {
  params: Promise<{ locale: string }>
}

export const dynamic = 'force-dynamic'

// Fullscreen mobile station picker. Each station is one large card sized for
// 375px viewports — cooks open their station once and never see the others.
export default async function MobileKDSSelectorPage({ params }: Props) {
  const { locale } = await params
  const isAr   = locale === 'ar'
  const prefix = locale === 'en' ? '/en' : ''
  const t      = await getTranslations('kds')

  // Guard already enforced by layout, but session is needed for branch scope
  const user = await getSession()
  const isGlobalKitchenViewer = user?.role === 'owner' || user?.role === 'general_manager'

  const supabase = await createClient()
  let countsQuery = supabase
    .from('order_item_station_status')
    .select('station, orders!inner(status)')
    .in('status', ['pending', 'preparing'])
    .in('orders.status', ['accepted', 'preparing', 'ready'])

  if (!isGlobalKitchenViewer && user?.branch_id) {
    countsQuery = countsQuery.eq('branch_id', user.branch_id)
  }

  const { data: countRows } = await countsQuery
  const counts: Partial<Record<KDSStation, number>> = {}
  for (const row of countRows ?? []) {
    const s = row.station as KDSStation
    counts[s] = (counts[s] ?? 0) + 1
  }

  // Visible stations: drop the synthetic "unassigned" bucket from the picker —
  // cooks don't own that queue, expediters do (from the dashboard board).
  const stations = (Object.entries(STATION_CONFIG) as Array<[KDSStation, NonNullable<(typeof STATION_CONFIG)[KDSStation]>]>)
    .filter(([key, cfg]) => !!cfg && key !== 'unassigned')

  return (
    <div className="min-h-screen flex flex-col px-5 pt-8 pb-6" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="text-center mb-6">
        <h1 className={`text-3xl font-black tracking-tight ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {t('mobileSelector.title')}
        </h1>
        <p className={`mt-1 text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('mobileSelector.subtitle')}
        </p>
      </header>

      <div className="flex-1 flex flex-col gap-3">
        {stations.map(([key, cfg]) => {
          const count = counts[key] ?? 0
          return (
            <Link
              key={key}
              href={`${prefix}/kds/${key}`}
              className="group flex items-center gap-4 ps-4 pe-4 py-5 min-h-[88px] rounded-2xl border border-brand-border bg-brand-surface active:bg-brand-surface-2 transition-colors"
              style={{ borderColor: count > 0 ? `${cfg.color}55` : undefined }}
            >
              <div
                className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${cfg.color}1a` }}
              >
                <Icon name={cfg.icon} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xl font-black tracking-tight ${isAr ? 'font-cairo' : 'font-editorial'}`}>
                  {isAr ? cfg.label.ar : cfg.label.en}
                </div>
                <div className={`text-xs text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {count > 0
                    ? t('mobileSelector.activeCount', { count })
                    : t('mobileSelector.idle')}
                </div>
              </div>
              <div className="shrink-0 text-end">
                <div
                  className="text-3xl font-black tabular-nums leading-none"
                  style={{ color: count > 0 ? cfg.color : undefined, opacity: count > 0 ? 1 : 0.3 }}
                >
                  {count}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
