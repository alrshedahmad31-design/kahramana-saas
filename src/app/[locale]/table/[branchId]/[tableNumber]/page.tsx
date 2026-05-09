import { notFound } from 'next/navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getMenuData } from '@/lib/menu.server'
import { BRANCHES } from '@/constants/contact'
import QRTableClient from './QRTableClient'
import type {
  POSCategory,
  POSModifierGroup,
  POSModifierOption,
} from '@/components/pos/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; branchId: string; tableNumber: string }>
}

interface RawGroup {
  id:             string
  menu_item_slug: string
  name_ar:        string
  name_en:        string
  required:       boolean
  multi_select:   boolean
  sort_order:     number
}

interface RawOption {
  id:             string
  group_id:       string
  name_ar:        string
  name_en:        string
  price_modifier: number
  is_available:   boolean
  sort_order:     number
}

async function loadModifierGroupsBySlug(): Promise<Map<string, POSModifierGroup[]>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const map = new Map<string, POSModifierGroup[]>()
  if (!url || !key) return map

  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: groups } = await supabase
    .from('menu_option_groups')
    .select('*')
    .order('sort_order', { ascending: true })
  if (!groups || groups.length === 0) return map

  const groupRows = groups as RawGroup[]
  const groupIds  = groupRows.map((g) => g.id)

  const { data: options } = await supabase
    .from('menu_options')
    .select('*')
    .in('group_id', groupIds)
    .eq('is_available', true)
    .order('sort_order', { ascending: true })

  const optionRows = (options ?? []) as RawOption[]
  const optionsByGroup = new Map<string, POSModifierOption[]>()
  for (const o of optionRows) {
    const arr = optionsByGroup.get(o.group_id) ?? []
    arr.push({
      id:            o.id,
      nameAr:        o.name_ar,
      nameEn:        o.name_en,
      priceModifier: Number(o.price_modifier),
      isAvailable:   o.is_available,
    })
    optionsByGroup.set(o.group_id, arr)
  }

  for (const g of groupRows) {
    const groupOptions = optionsByGroup.get(g.id) ?? []
    if (groupOptions.length === 0) continue
    const list = map.get(g.menu_item_slug) ?? []
    list.push({
      id:           g.id,
      nameAr:       g.name_ar,
      nameEn:       g.name_en,
      required:     g.required,
      multiSelect:  g.multi_select,
      options:      groupOptions,
    })
    map.set(g.menu_item_slug, list)
  }
  return map
}

export default async function QRTablePage({ params }: PageProps) {
  const { locale, branchId, tableNumber: tableNumberRaw } = await params
  const tableNumber = parseInt(tableNumberRaw, 10)
  if (!Number.isFinite(tableNumber) || tableNumber < 1) notFound()

  // Branch must exist in our static list (riffa / qallali) AND be active in DB
  const branch = (BRANCHES as Record<string, { id: string; nameAr: string; nameEn: string; status: string } | undefined>)[branchId]
  if (!branch || branch.status !== 'active') notFound()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) notFound()
  const untyped = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Validate table exists + is active
  type TableMeta = { id: string; label_ar: string | null; label_en: string | null }
  const { data: tableMetaRaw } = await untyped
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
