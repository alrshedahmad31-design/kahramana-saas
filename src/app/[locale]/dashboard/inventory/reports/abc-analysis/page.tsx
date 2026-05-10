import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { translateUnit } from '@/lib/inventory/units'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import StatCard from '@/components/inventory/reports/StatCard'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import AbcPieChart from './AbcPieChart'
import AbcUpdateButton from './AbcUpdateButton'

interface PageProps {
  params: Promise<{ locale: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function AbcAnalysisPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'inventory.reports.abcAnalysis' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const currency = tCommon('currency')
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const isOwnerOrGM = user.role === 'owner' || user.role === 'general_manager'
  const supabase = await createClient()

  const [{ data: ingredients }, { data: stocks }] = await Promise.all([
    supabase
      .from('ingredients')
      .select('id, name_ar, name_en, unit, cost_per_unit, abc_class')
      .eq('is_active', true)
      .order('abc_class'),
    supabase.from('inventory_stock').select('ingredient_id, on_hand'),
  ])

  if (!ingredients || ingredients.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <ReportHeader title={t('title')} />
        <EmptyReport title={t('emptyTitle')} description={t('emptyDesc')} />
      </div>
    )
  }

  const COUNT_FREQ: Record<string, string> = {
    A: t('weekly'),
    B: t('biMonthly'),
    C: t('monthly'),
  }

  // Merge stock onto ingredients
  const stockMap = new Map((stocks ?? []).map((s) => [s.ingredient_id, s.on_hand]))

  type EnrichedIngredient = {
    id: string
    name_ar: string
    name_en: string
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
      name_en: ing.name_en ?? ing.name_ar,
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <ReportHeader
        title={t('title')}
        description={t('desc')}
        actions={isOwnerOrGM ? <AbcUpdateButton locale={locale} /> : undefined}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {classStats.map((s) => (
          <StatCard
            key={s.cls}
            label={t('classLabel', { cls: s.cls })}
            value={t('itemsCount', { count: s.count })}
            sub={`${s.value.toFixed(3)} ${currency} (${s.pct.toFixed(1)}%)`}
            highlight={s.cls === 'A'}
          />
        ))}
      </div>

      {/* Chart & Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AbcPieChart data={pieData} />

        {/* Class explanation */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6 space-y-5 shadow-sm hover:shadow-md transition-all">
          <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text uppercase tracking-wider`}>{t('guide')}</h3>
          {[
            { cls: 'A', text: t('highValue'), colorClass: 'text-brand-error' },
            { cls: 'B', text: t('mediumValue'), colorClass: 'text-brand-gold' },
            { cls: 'C', text: t('lowValue'), colorClass: 'text-brand-success' },
          ].map((item) => (
            <div key={item.cls} className="flex items-start gap-4 group">
              <span className={`font-satoshi text-3xl font-black ${item.colorClass} w-10 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity`}>{item.cls}</span>
              <div>
                <p className={`${font} text-sm text-brand-text font-bold`}>{item.text}</p>
                <p className={`${font} text-xs text-brand-muted mt-1 font-medium`}>
                  {t('countFreq', { freq: COUNT_FREQ[item.cls] })}
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
          <div key={cls} className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border bg-brand-surface-2">
              <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text uppercase tracking-wider`}>
                {t('classHeader', { cls, count: items.length })}
              </h3>
              <span className={`${font} text-[10px] font-black text-brand-muted uppercase tracking-widest bg-brand-surface border border-brand-border/50 px-2 py-1 rounded-md shadow-sm`}>
                {t('countFreqLabel')}: {COUNT_FREQ[cls]}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead>
                  <tr className="bg-brand-surface-2/30">
                    <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{tCommon('ingredient')}</th>
                    <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('onHand')}</th>
                    <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('unitCost')}</th>
                    <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('value')} ({currency})</th>
                    <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('countFreqLabel')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/30">
                  {items.map((ing) => (
                    <tr key={ing.id} className="hover:bg-brand-surface-2 transition-colors group">
                      <td className={`px-5 py-3 ${font} text-sm font-medium text-brand-text group-hover:text-brand-gold transition-colors`}>{isAr ? ing.name_ar : ing.name_en}</td>
                      <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">
                        {ing.on_hand.toFixed(2)} 
                        <span className={`${font} text-[10px] ms-1 text-brand-muted/70 font-medium`}>{translateUnit(ing.unit, isAr)}</span>
                      </td>
                      <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">{ing.cost_per_unit.toFixed(3)}</td>
                      <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-gold tabular-nums">{ing.total_value.toFixed(3)}</td>
                      <td className={`px-5 py-3 text-end ${font} text-[10px] text-brand-muted font-bold uppercase`}>{COUNT_FREQ[cls]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

