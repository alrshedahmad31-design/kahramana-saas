import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { PrepItemRow } from '@/lib/supabase/custom-types'
import PrepItemForm from '@/components/inventory/PrepItemForm'
import PrepItemIngredientEditor from '@/components/inventory/PrepItemIngredientEditor'
import { upsertPrepItem, savePrepItemIngredients } from './actions'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

export default async function PrepItemDetailPage({ params }: PageProps) {
  const { locale, id } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  const [prepResult, ingredientsResult, allIngredientsResult] = await Promise.all([
    supabase.from('prep_items').select('*').eq('id', id).single(),
    supabase
      .from('prep_item_ingredients')
      .select('id, ingredient_id, quantity, yield_factor, ingredient:ingredients(id,name_ar,unit,cost_per_unit)')
      .eq('prep_item_id', id),
    supabase
      .from('ingredients')
      .select('id, name_ar, unit, cost_per_unit')
      .eq('is_active', true)
      .order('name_ar'),
  ])

  if (prepResult.error || !prepResult.data) {
    notFound()
  }

  const prepItem = prepResult.data as PrepItemRow
  const existingIngredients = (ingredientsResult.data ?? []) as Array<{
    id: string
    ingredient_id: string
    quantity: number
    yield_factor: number | null
    ingredient: { id: string; name_ar: string; unit: string; cost_per_unit: number } | null
  }>
  const allIngredients = (allIngredientsResult.data ?? []) as Array<{
    id: string
    name_ar: string
    unit: string
    cost_per_unit: number
  }>

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`${prefix}/dashboard/inventory/prep-items`}
            className="font-satoshi text-sm text-brand-muted hover:text-brand-gold transition-colors"
          >
            Prep Items
          </Link>
          <span className="text-brand-muted">/</span>
          <span className="font-satoshi text-sm text-brand-text">{prepItem.name_ar}</span>
        </div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">{prepItem.name_ar}</h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">{prepItem.name_en}</p>
      </div>

      {/* Edit Form */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
        <h2 className="font-cairo text-lg font-black text-brand-text mb-4">
          {isAr ? 'تعديل Prep Item' : 'Edit Prep Item'}
        </h2>
        <PrepItemForm
          prepItem={prepItem}
          locale={locale}
          action={upsertPrepItem}
        />
      </div>

      {/* Ingredient Editor */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
        <PrepItemIngredientEditor
          prepItemId={id}
          existingRows={existingIngredients}
          allIngredients={allIngredients}
          saveAction={savePrepItemIngredients}
          locale={locale}
        />
      </div>
    </div>
  )
}
