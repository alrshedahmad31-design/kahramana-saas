import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { IngredientRow, IngredientCategory, AbcClass } from '@/lib/supabase/custom-types'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ search?: string; category?: string; abc?: string; page?: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

const CATEGORIES = [
  { value: 'protein', ar: 'بروتين', en: 'Protein' },
  { value: 'grain', ar: 'حبوب', en: 'Grain' },
  { value: 'vegetable', ar: 'خضراوات', en: 'Vegetable' },
  { value: 'dairy', ar: 'ألبان', en: 'Dairy' },
  { value: 'seafood', ar: 'مأكولات بحرية', en: 'Seafood' },
  { value: 'spice', ar: 'بهارات', en: 'Spice' },
  { value: 'oil', ar: 'زيوت', en: 'Oil' },
  { value: 'beverage', ar: 'مشروبات', en: 'Beverage' },
  { value: 'sauce', ar: 'صلصات', en: 'Sauce' },
  { value: 'packaging', ar: 'تعبئة', en: 'Packaging' },
  { value: 'cleaning', ar: 'تنظيف', en: 'Cleaning' },
  { value: 'disposable', ar: 'مستهلكات', en: 'Disposable' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
]

function abcBadgeClass(cls: string) {
  if (cls === 'A') return 'bg-red-500/10 text-red-400'
  if (cls === 'B') return 'bg-brand-gold/10 text-brand-gold'
  return 'bg-green-500/10 text-green-400'
}

const PAGE_SIZE = 20

export default async function IngredientsPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { search, category, abc, page: pageStr } = await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let q = supabase
    .from('ingredients')
    .select('*', { count: 'exact' })
    .order('name_ar')

  if (search) q = q.or(`name_ar.ilike.%${search}%,name_en.ilike.%${search}%`)
  if (category) q = q.eq('category', category as IngredientCategory)
  if (abc) q = q.eq('abc_class', abc as AbcClass)

  q = q.range(from, to)

  const { data: ingredients, count } = await q
  const rows = (ingredients ?? []) as IngredientRow[]
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function buildHref(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    if ((overrides.search ?? search)) sp.set('search', overrides.search ?? search ?? '')
    if ((overrides.category ?? category)) sp.set('category', overrides.category ?? category ?? '')
    if ((overrides.abc ?? abc)) sp.set('abc', overrides.abc ?? abc ?? '')
    if (overrides.page) sp.set('page', overrides.page)
    const q = sp.toString()
    return `${prefix}/dashboard/inventory/ingredients${q ? '?' + q : ''}`
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? 'المكونات' : 'Ingredients'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {count ?? 0} {isAr ? 'مكوّن' : 'ingredients'}
          </p>
        </div>
        <Link
          href={`${prefix}/dashboard/inventory/ingredients/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2.5 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
        >
          + {isAr ? 'إضافة مكوّن' : 'Add Ingredient'}
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder={isAr ? 'بحث...' : 'Search...'}
          className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none w-48"
        />
        <select
          name="category"
          defaultValue={category ?? ''}
          className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none"
        >
          <option value="">{isAr ? 'كل الفئات' : 'All Categories'}</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{isAr ? c.ar : c.en}</option>
          ))}
        </select>
        <select
          name="abc"
          defaultValue={abc ?? ''}
          className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none"
        >
          <option value="">{isAr ? 'كل التصنيفات' : 'All Classes'}</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-surface-2 px-4 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors border border-brand-border"
        >
          {isAr ? 'بحث' : 'Search'}
        </button>
        {(search || category || abc) && (
          <Link
            href={`${prefix}/dashboard/inventory/ingredients`}
            className="rounded-lg px-3 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            {isAr ? 'إلغاء الفلتر' : 'Clear'}
          </Link>
        )}
      </form>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="border border-brand-border rounded-xl p-12 text-center">
          <p className="font-satoshi text-brand-muted">
            {isAr ? 'لا توجد مكونات' : 'No ingredients found'}
          </p>
        </div>
      ) : (
        <div className="border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-brand-surface-2">
              <tr>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الاسم' : 'Name'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الوحدة' : 'Unit'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'التكلفة / وحدة' : 'Cost / Unit'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'تصنيف' : 'ABC'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الفئة' : 'Category'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'نقطة الإعادة' : 'Reorder Pt.'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ing) => {
                const catLabel = CATEGORIES.find((c) => c.value === ing.category)
                return (
                  <tr key={ing.id} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`${prefix}/dashboard/inventory/ingredients/${ing.id}`}
                        className="group"
                      >
                        <p className="font-satoshi text-sm font-medium text-brand-text group-hover:text-brand-gold transition-colors">{ing.name_ar}</p>
                        <p className="font-satoshi text-xs text-brand-muted">{ing.name_en}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">{ing.unit}</td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{ing.cost_per_unit.toFixed(3)} BD</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-bold ${abcBadgeClass(ing.abc_class)}`}>
                        {ing.abc_class}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                      {catLabel ? (isAr ? catLabel.ar : catLabel.en) : '—'}
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                      {ing.reorder_point ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium
                        ${ing.is_active ? 'bg-green-500/10 text-green-400' : 'bg-brand-surface-2 text-brand-muted'}`}>
                        {isAr ? (ing.is_active ? 'نشط' : 'غير نشط') : (ing.is_active ? 'Active' : 'Inactive')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildHref({ page: String(page - 1) })}
              className="rounded-lg border border-brand-border px-3 py-2 font-satoshi text-sm text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
            >
              {isAr ? '← السابق' : '← Prev'}
            </Link>
          )}
          <span className="font-satoshi text-sm text-brand-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildHref({ page: String(page + 1) })}
              className="rounded-lg border border-brand-border px-3 py-2 font-satoshi text-sm text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
            >
              {isAr ? 'التالي →' : 'Next →'}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

