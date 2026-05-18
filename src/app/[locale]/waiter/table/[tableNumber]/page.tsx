import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { getMenuData } from '@/lib/menu.server'
import { loadModifierGroupsBySlug } from '@/lib/modifiers.server'
import { BRANCH_LIST } from '@/constants/contact'
import WaiterOrderClient from './WaiterOrderClient'
import type { POSCategory } from '@/components/pos/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ locale: string; tableNumber: string }>
  searchParams: Promise<{ branch?: string }>
}

export default async function WaiterTablePage({ params, searchParams }: PageProps) {
  const { locale, tableNumber: tableNumberRaw } = await params
  const search = await searchParams
  const prefix = locale === 'en' ? '/en' : ''

  const tableNumber = parseInt(tableNumberRaw, 10)
  if (!Number.isFinite(tableNumber) || tableNumber < 1) notFound()

  // Layout enforced requireDashboardSection('waiter'); read session for scope.
  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)

  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  const branchOptions = BRANCH_LIST.filter((b) => b.status === 'active')
  const branchId = isGlobalAdmin
    ? (search.branch ?? branchOptions[0]?.id ?? '')
    : (user.branch_id ?? '')

  if (!branchId) redirect(`${prefix}/waiter`)

  const supabase = await createServiceClient()
  type TableMeta = { id: string; label_ar: string | null; label_en: string | null }
  const { data: tableMetaRaw, error: tableMetaError } = await supabase
    .from('restaurant_tables')
    .select('id, label_ar, label_en')
    .eq('branch_id', branchId)
    .eq('table_number', tableNumber)
    .eq('is_active', true)
    .limit(1)

  if (tableMetaError) {
    console.error('[waiter/table] restaurant_tables query failed:', tableMetaError)
    notFound()
  }
  const tableMeta = (tableMetaRaw ?? []) as TableMeta[]
  if (tableMeta.length === 0) notFound()

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
        // Use the server-precomputed display price so SSR and CSR agree.
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

  return (
    <WaiterOrderClient
      categories={categories}
      branchId={branchId}
      tableNumber={tableNumber}
      labelAr={tableMeta[0].label_ar ?? `طاولة ${tableNumber}`}
      labelEn={tableMeta[0].label_en ?? `Table ${tableNumber}`}
      locale={locale === 'en' ? 'en' : 'ar'}
    />
  )
}
