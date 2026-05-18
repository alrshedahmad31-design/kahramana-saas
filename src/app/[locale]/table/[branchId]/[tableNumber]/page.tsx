import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getMenuData } from '@/lib/menu.server'
import { loadModifierGroupsBySlug } from '@/lib/modifiers.server'
import { BRANCHES } from '@/constants/contact'
import QRTableClient from './QRTableClient'
import type { POSCategory } from '@/components/pos/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; branchId: string; tableNumber: string }>
}

export default async function QRTablePage({ params }: PageProps) {
  const { locale, branchId, tableNumber: tableNumberRaw } = await params
  const tableNumber = parseInt(tableNumberRaw, 10)
  if (!Number.isFinite(tableNumber) || tableNumber < 1) notFound()

  // Branch must exist in our static list (riffa / qallali) AND be active in DB
  const branch = (BRANCHES as Record<string, { id: string; nameAr: string; nameEn: string; status: string } | undefined>)[branchId]
  if (!branch || branch.status !== 'active') notFound()

  const supabase = await createServiceClient()

  // Validate table exists + is active
  type TableMeta = { id: string; label_ar: string | null; label_en: string | null }
  const { data: tableMetaRaw } = await supabase
    .from('restaurant_tables')
    .select('id, label_ar, label_en')
    .eq('branch_id', branchId)
    .eq('table_number', tableNumber)
    .eq('is_active', true)
    .limit(1)
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
        priceBhd:     typeof item.price_bhd === 'number' ? item.price_bhd : null,
        // Server-precomputed display price so SSR and CSR agree.
        fromPriceBhd: item.fromPrice,
        sizes:        item.sizes
          ? Object.entries(item.sizes)
              .filter(([, p]) => typeof p === 'number')
              .map(([label, p]) => ({ label, priceBhd: p as number }))
          : [],
        variants:     (item.variants ?? [])
          .filter((v) => typeof v.price_bhd === 'number')
          .map((v) => ({
            labelAr:  v.label.ar,
            labelEn:  v.label.en,
            priceBhd: v.price_bhd as number,
          })),
        modifierGroups: modifiersBySlug.get(item.slug) ?? [],
      })),
    }))
    .filter((cat) => cat.items.length > 0)

  return (
    <QRTableClient
      categories={categories}
      branchId={branchId}
      branchNameAr={branch.nameAr}
      branchNameEn={branch.nameEn}
      tableNumber={tableNumber}
      tableLabelAr={tableMeta[0].label_ar ?? `طاولة ${tableNumber}`}
      tableLabelEn={tableMeta[0].label_en ?? `Table ${tableNumber}`}
      locale={locale === 'en' ? 'en' : 'ar'}
    />
  )
}
