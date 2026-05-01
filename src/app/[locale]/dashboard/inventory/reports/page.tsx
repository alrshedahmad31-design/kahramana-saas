import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import ReportHeader from '@/components/inventory/reports/ReportHeader'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const REPORTS = [
  { key: 'cogs',             icon: '💰', titleAr: 'تكلفة الأصناف (COGS)',          descAr: 'هامش الربح لكل طبق',                         titleEn: 'Dish COGS',            descEn: 'Profit margin per dish' },
  { key: 'variance',         icon: '📊', titleAr: 'تقرير التباين',                  descAr: 'الفرق بين الاستهلاك الفعلي والنظري',          titleEn: 'Variance Report',      descEn: 'Actual vs theoretical usage' },
  { key: 'waste',            icon: '🗑️', titleAr: 'تقرير الهدر',                   descAr: 'تحليل الهدر حسب السبب والمكوّن',              titleEn: 'Waste Report',         descEn: 'Waste analysis by reason' },
  { key: 'valuation',        icon: '🏦', titleAr: 'تقييم المخزون',                  descAr: 'القيمة الإجمالية للمخزون بالفرع',             titleEn: 'Inventory Valuation',  descEn: 'Total stock value by branch' },
  { key: 'menu-engineering', icon: '🗺️', titleAr: 'هندسة القائمة',                 descAr: 'مصفوفة Stars/Puzzles/Plowhorses/Dogs',        titleEn: 'Menu Engineering',     descEn: 'Stars/Puzzles/Plowhorses/Dogs matrix' },
  { key: 'vendor',           icon: '🏪', titleAr: 'أداء الموردين',                  descAr: 'دقة التسليم والجودة والإنفاق',                titleEn: 'Vendor Performance',   descEn: 'Delivery accuracy, quality, spend' },
  { key: 'dead-stock',       icon: '💤', titleAr: 'المخزون الراكد',                 descAr: 'أصناف لم تتحرك منذ فترة',                    titleEn: 'Dead Stock',           descEn: 'Items with no movement' },
  { key: 'expiry',           icon: '⏰', titleAr: 'تقرير الصلاحية',                 descAr: 'المخزون القريب من الانتهاء',                  titleEn: 'Expiry Report',        descEn: 'Stock nearing expiry' },
  { key: 'price-history',    icon: '📈', titleAr: 'سجل الأسعار',                   descAr: 'تاريخ أسعار المشتريات من الموردين',           titleEn: 'Price History',        descEn: 'Purchase price history by supplier' },
  { key: 'abc-analysis',     icon: '🔤', titleAr: 'تحليل ABC',                     descAr: 'تصنيف المخزون حسب القيمة',                    titleEn: 'ABC Analysis',         descEn: 'Inventory classification by value' },
  { key: 'food-cost',        icon: '🍽️', titleAr: 'تكلفة الغذاء',                  descAr: 'نسبة تكلفة الغذاء الفعلية مقابل الهدف',      titleEn: 'Food Cost',            descEn: 'Actual vs target food cost %' },
]

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function ReportsHubPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  return (
    <div className="space-y-8">
      <ReportHeader
        title={isAr ? 'التقارير والذكاء' : 'Reports & Intelligence'}
        description={isAr ? 'تقارير شاملة لمساعدتك في اتخاذ القرارات الصحيحة' : 'Comprehensive reports to help you make informed decisions'}
        locale={locale}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {REPORTS.map((report) => (
          <Link
            key={report.key}
            href={`${prefix}/dashboard/inventory/reports/${report.key}`}
            className="group flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-surface p-5 hover:border-brand-gold hover:bg-brand-surface-2 transition-colors duration-150"
          >
            <span className="text-3xl">{report.icon}</span>
            <div>
              <p className="font-cairo text-sm font-black text-brand-text group-hover:text-brand-gold transition-colors">
                {isAr ? report.titleAr : report.titleEn}
              </p>
              <p className="font-satoshi text-xs text-brand-muted mt-1 leading-relaxed">
                {isAr ? report.descAr : report.descEn}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
