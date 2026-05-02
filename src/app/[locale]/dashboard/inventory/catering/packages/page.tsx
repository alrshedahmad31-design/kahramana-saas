import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import type { CateringPackageRow, CateringPackageItem } from '@/lib/supabase/custom-types'

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

interface PageProps {
  params: Promise<{ locale: string }>
}

export const dynamic = 'force-dynamic'

export default async function CateringPackagesPage({ params }: PageProps) {
  const { locale } = await params
  const isAr  = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('catering_packages')
    .select('*')
    .order('name_ar')

  const packages = (data ?? []) as unknown as CateringPackageRow[]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`${prefix}/dashboard/inventory/catering`}
            className="font-satoshi text-xs text-brand-muted hover:text-brand-gold transition-colors"
          >
            ‹ {isAr ? 'طلبات التقديم' : 'Catering Orders'}
          </Link>
          <h1 className="font-cairo text-2xl font-black text-brand-text mt-1">
            {isAr ? 'باقات التقديم' : 'Catering Packages'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {isAr ? 'إدارة الباقات والقوائم' : 'Manage packages and menus'}
          </p>
        </div>
        <Link
          href={`${prefix}/dashboard/inventory/catering/packages/new`}
          className="rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-bold text-brand-black hover:bg-brand-goldLight transition-colors"
        >
          {isAr ? '+ باقة جديدة' : '+ New Package'}
        </Link>
      </div>

      {/* Package grid */}
      {packages.length === 0 ? (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
          <p className="font-satoshi text-sm text-brand-muted">
            {isAr ? 'لا توجد باقات حتى الآن' : 'No packages yet'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => {
            const items = (pkg.items ?? []) as CateringPackageItem[]
            return (
              <div
                key={pkg.id}
                className={`bg-brand-surface border rounded-xl p-5 flex flex-col gap-3
                  ${pkg.is_active ? 'border-brand-border' : 'border-brand-border/40 opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-cairo font-bold text-brand-text">
                      {isAr ? pkg.name_ar : pkg.name_en}
                    </h3>
                    {!pkg.is_active && (
                      <span className="font-satoshi text-xs text-brand-muted">
                        {isAr ? '(غير نشطة)' : '(inactive)'}
                      </span>
                    )}
                  </div>
                  <p className="font-cairo font-black text-brand-gold shrink-0">
                    {Number(pkg.price_per_person_bhd).toFixed(3)} <span className="text-xs font-satoshi font-normal text-brand-muted">BD/{isAr ? 'شخص' : 'person'}</span>
                  </p>
                </div>

                {(pkg.description_ar || pkg.description_en) && (
                  <p className="font-satoshi text-xs text-brand-muted">
                    {isAr ? pkg.description_ar : pkg.description_en}
                  </p>
                )}

                <div className="flex items-center gap-3 font-satoshi text-xs text-brand-muted">
                  <span>{isAr ? `الحد الأدنى: ${pkg.min_guests}` : `Min: ${pkg.min_guests}`}</span>
                  {pkg.max_guests && <span>·</span>}
                  {pkg.max_guests && (
                    <span>{isAr ? `الحد الأقصى: ${pkg.max_guests}` : `Max: ${pkg.max_guests}`}</span>
                  )}
                </div>

                {items.length > 0 && (
                  <div className="flex flex-col gap-1 pt-1 border-t border-brand-border">
                    <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                      {isAr ? 'الأصناف' : 'Items'} ({items.length})
                    </p>
                    {items.slice(0, 3).map((item) => (
                      <p key={item.menu_item_slug} className="font-satoshi text-xs text-brand-text">
                        {isAr ? item.name_ar : item.name_en}
                        <span className="text-brand-muted"> × {item.qty_per_person}/{isAr ? 'شخص' : 'person'}</span>
                      </p>
                    ))}
                    {items.length > 3 && (
                      <p className="font-satoshi text-xs text-brand-muted">
                        +{items.length - 3} {isAr ? 'أصناف أخرى' : 'more'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
