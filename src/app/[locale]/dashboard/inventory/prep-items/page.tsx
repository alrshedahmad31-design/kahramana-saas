import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { PrepItemRow } from '@/lib/supabase/custom-types'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ search?: string; page?: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

const STORAGE_LABELS: Record<string, { ar: string; en: string }> = {
  frozen:  { ar: 'مجمد',        en: 'Frozen' },
  chilled: { ar: 'مبرد',        en: 'Chilled' },
  ambient: { ar: 'درجة الغرفة', en: 'Ambient' },
}

const PAGE_SIZE = 20

export default async function PrepItemsPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { search, page: pageStr } = await searchParams
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
    .from('prep_items')
    .select('*', { count: 'exact' })
    .order('name_ar')

  if (search) q = q.or(`name_ar.ilike.%${search}%,name_en.ilike.%${search}%`)

  q = q.range(from, to)

  const { data, count } = await q
  const rows = (data ?? []) as PrepItemRow[]
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function buildHref(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    if (overrides.search ?? search) sp.set('search', overrides.search ?? search ?? '')
    if (overrides.page) sp.set('page', overrides.page)
    const qs = sp.toString()
    return `${prefix}/dashboard/inventory/prep-items${qs ? '?' + qs : ''}`
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            Prep Items
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {count ?? 0} {isAr ? 'عنصر' : 'items'}
          </p>
        </div>
        <Link
          href={`${prefix}/dashboard/inventory/prep-items/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2.5 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
        >
          + {isAr ? 'إضافة Prep Item' : 'Add Prep Item'}
        </Link>
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-3">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder={isAr ? 'بحث...' : 'Search...'}
          className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none w-48"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-surface-2 px-4 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text border border-brand-border transition-colors"
        >
          {isAr ? 'بحث' : 'Search'}
        </button>
      </form>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="border border-brand-border rounded-xl p-12 text-center">
          <p className="font-satoshi text-brand-muted">
            {isAr ? 'لا توجد Prep Items' : 'No prep items found'}
          </p>
        </div>
      ) : (
        <div className="border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-brand-surface-2">
              <tr>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الاسم' : 'Name'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الوحدة' : 'Unit'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'إنتاج الدفعة' : 'Batch Yield'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الصلاحية (ساعة)' : 'Shelf Life (h)'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'التخزين' : 'Storage'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const storageLabel = item.storage_temp ? STORAGE_LABELS[item.storage_temp] : null
                return (
                  <tr key={item.id} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`${prefix}/dashboard/inventory/prep-items/${item.id}`} className="group">
                        <p className="font-satoshi text-sm font-medium text-brand-text group-hover:text-brand-gold transition-colors">{item.name_ar}</p>
                        <p className="font-satoshi text-xs text-brand-muted">{item.name_en}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">{item.unit}</td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{item.batch_yield_qty}</td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">{item.shelf_life_hours ?? '—'}</td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                      {storageLabel ? (isAr ? storageLabel.ar : storageLabel.en) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium
                        ${item.is_active ? 'bg-green-500/10 text-green-400' : 'bg-brand-surface-2 text-brand-muted'}`}>
                        {isAr ? (item.is_active ? 'نشط' : 'غير نشط') : (item.is_active ? 'Active' : 'Inactive')}
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
          <span className="font-satoshi text-sm text-brand-muted">{page} / {totalPages}</span>
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
