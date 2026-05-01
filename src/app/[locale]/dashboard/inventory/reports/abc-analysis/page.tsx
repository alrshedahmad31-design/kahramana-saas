import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import StatCard from '@/components/inventory/reports/StatCard'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import AbcPieChart from './AbcPieChart'
import AbcUpdateButton from './AbcUpdateButton'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

const COUNT_FREQ: Record<string, { ar: string; en: string }> = {
  A: { ar: 'أسبوعياً',    en: 'Weekly' },
  B: { ar: 'نصف شهري',   en: 'Bi-monthly' },
  C: { ar: 'شهرياً',      en: 'Monthly' },
}

export default async function AbcAnalysisPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const isOwnerOrGM = user.role === 'owner' || user.role === 'general_manager'
  const supabase = await createClient()

  const [{ data: ingredients }, { data: stocks }] = await Promise.all([
    supabase
      .from('ingredients')
      .select('id, name_ar, unit, cost_per_unit, abc_class')
      .eq('is_active', true)
      .order('abc_class'),
    supabase.from('inventory_stock').select('ingredient_id, on_hand'),
  ])

  if (!ingredients || ingredients.length === 0) {
    return (
      <div className="space-y-6">
        <ReportHeader title={isAr ? 'تحليل ABC' : 'ABC Analysis'} locale={locale} />
        <EmptyReport title={isAr ? 'لا توجد مكوّنات' : 'No ingredients'} description={isAr ? 'لم يتم إضافة مكوّنات بعد' : 'No ingredients added yet'} />
      </div>
    )
  }

  // Merge stock onto ingredients
  const stockMap = new Map((stocks ?? []).map((s) => [s.ingredient_id, s.on_hand]))

  type EnrichedIngredient = {
    id: string
    name_ar: string
    unit: string
    cost_per_unit: number
    abc_class: string
    on_hand: number
    total_value: number
  }

  const enriched: EnrichedIngredient[] = ingredients.map((ing) => {
    const onHand = Number(stockMap.get(ing.id) ?? 0)
    const totalValue = onHand * Number(ing.cost_per_unit ?? 0)
    return {
      id: ing.id,
      name_ar: ing.name_ar,
      unit: ing.unit ?? '',
      cost_per_unit: Number(ing.cost_per_unit ?? 0),
      abc_class: ing.abc_class ?? 'C',
      on_hand: onHand,
      total_value: totalValue,
    }
  })

  const totalValue = enriched.reduce((s, i) => s + i.total_value, 0)

  // Group by abc_class
  const grouped: Record<string, EnrichedIngredient[]> = { A: [], B: [], C: [] }
  for (const ing of enriched) {
    const cls = ing.abc_class
    if (cls === 'A' || cls === 'B' || cls === 'C') {
      grouped[cls].push(ing)
    } else {
      grouped['C'].push(ing)
    }
  }

  const classStats = ['A', 'B', 'C'].map((cls) => {
    const items = grouped[cls] ?? []
    const val = items.reduce((s, i) => s + i.total_value, 0)
    return { cls, count: items.length, value: val, pct: totalValue > 0 ? (val / totalValue) * 100 : 0 }
  })

  const pieData = classStats.map((s) => ({ name: s.cls, value: s.value }))

  return (
    <div className="space-y-6">
      <ReportHeader
        title={isAr ? 'تحليل ABC' : 'ABC Analysis'}
        description={isAr ? 'تصنيف المخزون حسب القيمة' : 'Inventory classification by value'}
        locale={locale}
        actions={isOwnerOrGM ? <AbcUpdateButton isAr={isAr} /> : undefined}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {classStats.map((s) => (
          <StatCard
            key={s.cls}
            label={isAr ? `تصنيف ${s.cls}` : `Class ${s.cls}`}
            value={`${s.count} ${isAr ? 'صنف' : 'items'}`}
            sub={`BD ${s.value.toFixed(3)} (${s.pct.toFixed(1)}%)`}
            highlight={s.cls === 'A'}
          />
        ))}
      </div>

      {/* Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AbcPieChart data={pieData} />

        {/* Class explanation */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6 space-y-4">
          <h3 className="font-cairo text-sm font-black text-brand-text">{isAr ? 'دليل التصنيف' : 'Classification Guide'}</h3>
          {[
            { cls: 'A', ar: 'القيمة العالية — 80% من الإجمالي', en: 'High value — 80% of total', colorClass: 'text-brand-error' },
            { cls: 'B', ar: 'القيمة المتوسطة — 15% من الإجمالي', en: 'Medium value — 15% of total', colorClass: 'text-brand-gold' },
            { cls: 'C', ar: 'القيمة المنخفضة — 5% من الإجمالي', en: 'Low value — 5% of total', colorClass: 'text-green-400' },
          ].map((item) => (
            <div key={item.cls} className="flex items-start gap-3">
              <span className={`font-cairo text-2xl font-black ${item.colorClass} w-8 shrink-0`}>{item.cls}</span>
              <div>
                <p className="font-satoshi text-sm text-brand-text">{isAr ? item.ar : item.en}</p>
                <p className="font-satoshi text-xs text-brand-muted mt-0.5">
                  {isAr ? `تكرار الجرد: ${COUNT_FREQ[item.cls].ar}` : `Count frequency: ${COUNT_FREQ[item.cls].en}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tables by class */}
      {(['A', 'B', 'C'] as const).map((cls) => {
        const items = grouped[cls] ?? []
        if (items.length === 0) return null
        return (
          <div key={cls} className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border bg-brand-surface-2">
              <h3 className="font-cairo text-sm font-black text-brand-text">
                {isAr ? `تصنيف ${cls}` : `Class ${cls}`} — {items.length} {isAr ? 'صنف' : 'items'}
              </h3>
              <span className="font-satoshi text-xs text-brand-muted">{isAr ? `جرد ${COUNT_FREQ[cls].ar}` : `Count ${COUNT_FREQ[cls].en}`}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="px-4 py-2 text-start font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'المكوّن' : 'Ingredient'}</th>
                  <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'المتوفر' : 'On Hand'}</th>
                  <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'سعر الوحدة BD' : 'Unit Cost BD'}</th>
                  <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'القيمة BD' : 'Value BD'}</th>
                  <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'تكرار الجرد' : 'Count Freq'}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ing) => (
                  <tr key={ing.id} className="border-b border-brand-border/30 hover:bg-brand-surface-2 transition-colors">
                    <td className="px-4 py-2 font-satoshi text-brand-text">{ing.name_ar}</td>
                    <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-muted">{ing.on_hand.toFixed(2)} {ing.unit}</td>
                    <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-muted">{ing.cost_per_unit.toFixed(3)}</td>
                    <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-gold font-semibold">{ing.total_value.toFixed(3)}</td>
                    <td className="px-4 py-2 text-end font-satoshi text-xs text-brand-muted">{isAr ? COUNT_FREQ[cls].ar : COUNT_FREQ[cls].en}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
