import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canAccessKDS } from '@/lib/auth/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import KDSBoard from '@/components/kds/KDSBoard'
import type { KDSOrder, LowStockAlert } from '@/lib/supabase/custom-types'

type StockStatus = 'ok' | 'low' | 'unmapped'

interface Props {
  params: Promise<{ locale: string }>
}

export const dynamic = 'force-dynamic'

export default async function KDSPage({ params }: Props) {
  const { locale } = await params

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessKDS(user)) redirect(`/${locale}/dashboard`)

  const supabase = await createServiceClient()
  const isGlobalKitchenViewer = user.role === 'owner' || user.role === 'general_manager'

  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items(id, name_ar, name_en, quantity, selected_size, selected_variant, menu_item_slug)
    `)
    .in('status', ['accepted', 'preparing', 'ready'])
    .order('created_at', { ascending: true })

  if (!isGlobalKitchenViewer && user.branch_id) {
    query = query.eq('branch_id', user.branch_id)
  }

  const { data } = await query

  // ── Stock status for KDS dots ─────────────────────────────────────────────
  // Non-blocking — if it fails, KDS still works without dots.
  const slugStockMap: Record<string, StockStatus> = {}
  try {
    const branchForStock = isGlobalKitchenViewer ? null : user.branch_id ?? null
    const lowStockRpc = branchForStock
      ? supabase.rpc('rpc_low_stock_alerts', { p_branch_id: branchForStock })
      : Promise.resolve({ data: [] as LowStockAlert[], error: null })
    const [lowStockRes, recipesRes] = await Promise.all([
      lowStockRpc,
      supabase.from('recipes').select('menu_item_slug, ingredient_id').not('ingredient_id', 'is', null),
    ])

    const lowStockIds = new Set(
      ((lowStockRes.data ?? []) as LowStockAlert[]).map(r => r.ingredient_id)
    )
    const recipeRows = (recipesRes.data ?? []) as Array<{ menu_item_slug: string; ingredient_id: string | null }>

    // Group recipe rows by slug
    const slugIngredients = new Map<string, string[]>()
    for (const row of recipeRows) {
      if (!row.ingredient_id) continue
      const existing = slugIngredients.get(row.menu_item_slug) ?? []
      existing.push(row.ingredient_id)
      slugIngredients.set(row.menu_item_slug, existing)
    }

    // Build map: for each slug in recipes, check if any ingredient is low
    for (const [slug, ingredientIds] of slugIngredients.entries()) {
      const hasLow = ingredientIds.some(id => lowStockIds.has(id))
      slugStockMap[slug] = hasLow ? 'low' : 'ok'
    }

    // Collect all unique slugs from current KDS orders
    for (const order of (data ?? []) as KDSOrder[]) {
      for (const item of order.order_items ?? []) {
        if (item.menu_item_slug && !(item.menu_item_slug in slugStockMap)) {
          slugStockMap[item.menu_item_slug] = 'unmapped'
        }
      }
    }
  } catch {
    // KDS stock dots are non-critical — continue without them
  }

  return (
    <div className="h-[calc(100dvh-4rem)] overflow-hidden">
      <KDSBoard
        initialOrders={(data ?? []) as KDSOrder[]}
        locale={locale}
        branchId={isGlobalKitchenViewer ? null : user.branch_id ?? null}
        userRole={user.role}
        slugStockMap={slugStockMap}
      />
    </div>
  )
}
