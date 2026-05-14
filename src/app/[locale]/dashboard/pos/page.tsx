import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireDashboardSection } from '@/lib/auth/dashboard-guards'
import { getMenuData } from '@/lib/menu.server'
import { loadModifierGroupsBySlug } from '@/lib/modifiers.server'
import { BRANCH_LIST } from '@/constants/contact'
import POSClient from '@/components/pos/POSClient'
import type { POSCategory } from '@/components/pos/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function POSPage({ params }: PageProps) {
  const { locale } = await params
  const prefix = locale === 'en' ? '/en' : ''
  let user
  try {
    user = await requireDashboardSection('pos')
  } catch {
    redirect(`${prefix}/dashboard`)
  }

  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  const lockedBranchId = isGlobalAdmin ? null : user.branch_id

  const [menuData, modifiersBySlug] = await Promise.all([
    getMenuData(),
    loadModifierGroupsBySlug(),
  ])

  const categories: POSCategory[] = menuData
    .map((cat) => ({
      id:     cat.id,
      nameAr: cat.nameAR,
      nameEn: cat.nameEN ?? cat.nameAR,
      items:  cat.items.map((item) => ({
        id:           item.slug,
        nameAr:       item.name.ar,
        nameEn:       item.name.en,
        image:        item.image,
        available:    item.available,
        priceBhd:     (typeof item.price_bhd === 'number' && item.price_bhd > 0) ? item.price_bhd : null,
        // Server-precomputed display price (NormalizedMenuItem.fromPrice)
        // so SSR and client renders never disagree.
        fromPriceBhd: item.fromPrice,
        sizes:        item.sizes
          ? Object.entries(item.sizes)
              .filter(([, p]) => typeof p === 'number')
              .map(([label, p]) => ({ label, priceBhd: p as number }))
          : [],
        variants:     (item.variants ?? [])
          .map((v) => ({
            labelAr:  v.label.ar,
            labelEn:  v.label.en,
            priceBhd: v.price_bhd ?? 0,
          })),
        modifierGroups: modifiersBySlug.get(item.slug) ?? [],
      })),
    }))
    .filter((cat) => cat.items.length > 0)

  const branches = BRANCH_LIST
    .filter((b) => b.status === 'active')
    .map((b) => ({ id: b.id, nameAr: b.nameAr, nameEn: b.nameEn }))

  const t = await getTranslations('pos')

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Link
          href={`${prefix}/dashboard/pos/service`}
          className="inline-flex items-center gap-2 min-h-[44px] rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 text-sm font-satoshi font-bold text-brand-gold hover:bg-brand-gold/20 transition-colors"
        >
          {t('service.openServiceMode')}
        </Link>
      </div>
      <POSClient
        categories={categories}
        branches={branches}
        lockedBranchId={lockedBranchId}
        locale={locale === 'en' ? 'en' : 'ar'}
      />
    </>
  )
}
