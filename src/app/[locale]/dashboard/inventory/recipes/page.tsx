import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { DishCogsRow } from '@/lib/supabase/custom-types'

interface PageProps {
  params: Promise<{ locale: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

function marginBadgeClass(margin: number | null): string {
  if (margin === null) return 'bg-brand-surface-2 text-brand-muted'
  if (margin >= 60) return 'bg-green-500/10 text-green-400'
  if (margin >= 40) return 'bg-brand-gold/10 text-brand-gold'
  return 'bg-red-500/10 text-red-400'
}

export default async function RecipesPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  const [dishesResult, recipeSlugsResult] = await Promise.all([
    supabase.from('v_dish_cogs').select('*').order('name_ar'),
    supabase.from('recipes').select('menu_item_slug'),
  ])

  const dishes = (dishesResult.data ?? []) as DishCogsRow[]
  const rawSlugs = recipeSlugsResult.data ?? []
  const recipeSlugsSet = new Set(rawSlugs.map((r: { menu_item_slug: string }) => r.menu_item_slug))

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">
          {isAr ? 'وصفات الأطباق' : 'Dish Recipes'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">
          {dishes.length} {isAr ? 'طبق' : 'dishes'}
        </p>
      </div>

      {dishes.length === 0 ? (
        <div className="border border-brand-border rounded-xl p-12 text-center">
          <p className="font-satoshi text-brand-muted">
            {isAr ? 'لا توجد أطباق' : 'No dishes found'}
          </p>
        </div>
      ) : (
        <div className="border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-brand-surface-2">
              <tr>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الطبق' : 'Dish'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'السعر' : 'Price'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'تكلفة BD' : 'Cost BD'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'هامش الربح' : 'Margin'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الوصفة' : 'Recipe'}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {dishes.map((dish) => {
                const hasRecipe = recipeSlugsSet.has(dish.slug)
                return (
                  <tr key={dish.slug} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-satoshi text-sm font-medium text-brand-text">{dish.name_ar}</p>
                      <p className="font-satoshi text-xs text-brand-muted">{dish.name_en}</p>
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                      {dish.selling_price !== null ? `${Number(dish.selling_price).toFixed(3)} BD` : '—'}
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-gold">
                      {Number(dish.cost_bhd).toFixed(3)} BD
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${marginBadgeClass(dish.margin_pct)}`}>
                        {dish.margin_pct !== null ? `${Number(dish.margin_pct).toFixed(1)}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {hasRecipe ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium bg-green-500/10 text-green-400">
                          {isAr ? 'موجودة' : 'Defined'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium bg-red-500/10 text-red-400">
                          {isAr ? 'لا وصفة' : 'No Recipe'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`${prefix}/dashboard/inventory/recipes/${dish.slug}`}
                        className="font-satoshi text-sm text-brand-gold hover:underline"
                      >
                        {isAr ? 'تعديل' : 'Edit'}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

