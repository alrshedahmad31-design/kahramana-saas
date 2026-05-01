import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { RecipeRow } from '@/lib/supabase/custom-types'
import RecipeEditor from '@/components/inventory/RecipeEditor'
import { upsertRecipe } from './actions'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

export default async function RecipeSlugPage({ params }: PageProps) {
  const { locale, slug } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  const [
    menuItemResult,
    ingRecipesResult,
    prepRecipesResult,
    allIngredientsResult,
    allPrepItemsResult,
  ] = await Promise.all([
    supabase
      .from('menu_items_sync')
      .select('slug, name_ar, name_en, price_bhd')
      .eq('slug', slug)
      .single(),
    supabase
      .from('recipes')
      .select('*, ingredient:ingredients(id,name_ar,unit,cost_per_unit)')
      .eq('menu_item_slug', slug)
      .not('ingredient_id', 'is', null),
    supabase
      .from('recipes')
      .select('*, prep_item:prep_items(id,name_ar,unit)')
      .eq('menu_item_slug', slug)
      .not('prep_item_id', 'is', null),
    supabase
      .from('ingredients')
      .select('id,name_ar,unit,cost_per_unit')
      .eq('is_active', true)
      .order('name_ar'),
    supabase
      .from('prep_items')
      .select('id,name_ar,unit')
      .eq('is_active', true)
      .order('name_ar'),
  ])

  if (menuItemResult.error || !menuItemResult.data) {
    notFound()
  }

  const menuItem = menuItemResult.data

  type IngRecipe = RecipeRow & {
    ingredient_name_ar: string
    ingredient_unit: string
    ingredient_cost: number
  }
  type PrepRecipe = RecipeRow & {
    prep_item_name_ar: string
    prep_item_unit: string
  }

  const existingIngredients: IngRecipe[] = (ingRecipesResult.data ?? []).map((r) => ({
    ...r,
    is_optional: r.is_optional ?? false,
    updated_at: r.updated_at ?? '',
    ingredient_name_ar: r.ingredient?.name_ar ?? '',
    ingredient_unit: r.ingredient?.unit ?? '',
    ingredient_cost: r.ingredient?.cost_per_unit ?? 0,
  })) as IngRecipe[]

  const existingPrepItems: PrepRecipe[] = (prepRecipesResult.data ?? []).map((r) => ({
    ...r,
    is_optional: r.is_optional ?? false,
    updated_at: r.updated_at ?? '',
    prep_item_name_ar: r.prep_item?.name_ar ?? '',
    prep_item_unit: r.prep_item?.unit ?? '',
  })) as PrepRecipe[]

  const allIngredients = (allIngredientsResult.data ?? []) as {
    id: string; name_ar: string; unit: string; cost_per_unit: number
  }[]

  const allPrepItems = (allPrepItemsResult.data ?? []) as {
    id: string; name_ar: string; unit: string
  }[]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`${prefix}/dashboard/inventory/recipes`}
            className="font-satoshi text-sm text-brand-muted hover:text-brand-gold transition-colors"
          >
            {isAr ? 'الوصفات' : 'Recipes'}
          </Link>
          <span className="text-brand-muted">/</span>
          <span className="font-satoshi text-sm text-brand-text">{menuItem.name_ar}</span>
        </div>
      </div>

      {/* Editor */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
        <RecipeEditor
          slug={slug}
          dishName={isAr ? menuItem.name_ar : (menuItem.name_en ?? menuItem.name_ar)}
          dishPrice={menuItem.price_bhd}
          existingIngredients={existingIngredients}
          existingPrepItems={existingPrepItems}
          allIngredients={allIngredients}
          allPrepItems={allPrepItems}
          saveAction={upsertRecipe}
          locale={locale}
        />
      </div>
    </div>
  )
}
