import type { MetricsData } from './queries'

export interface Insight {
  type:        'alert' | 'opportunity' | 'achievement' | 'info'
  severity:    'high' | 'medium' | 'low'
  title:       string
  titleAr:     string
  description: string
  descAr:      string
  action?:     string
  actionAr?:   string
}

function pct(n: number) { return `${Math.abs(n).toFixed(0)}%` }
function sign(n: number) { return n >= 0 ? '+' : '-' }

export function generateInsights(
  metrics:      MetricsData,
  topItemNameEn: string | null,
  topItemNameAr: string | null,
  peakHour:      number | null,
): Insight[] {
  const out: Insight[] = []

  // ── Revenue vs previous period ──────────────────────────────────────────────
  if (metrics.prevTotalRevenue > 0) {
    const delta = ((metrics.totalRevenue - metrics.prevTotalRevenue) / metrics.prevTotalRevenue) * 100

    if (delta <= -15) {
      out.push({
        type: 'alert', severity: 'high',
        title:  `Revenue down ${pct(delta)} vs last period`,
        titleAr: `الإيرادات انخفضت ${pct(delta)} عن الفترة السابقة`,
        description: 'Revenue has dropped significantly. Consider a promotion or check if orders are being cancelled.',
        descAr: 'انخفضت الإيرادات بشكل ملحوظ. فكر في عرض ترويجي أو تحقق من معدل الإلغاء.',
        action: 'Create a coupon', actionAr: 'إنشاء كوبون',
      })
    } else if (delta <= -5) {
      out.push({
        type: 'opportunity', severity: 'medium',
        title:  `Revenue down ${pct(delta)} — opportunity to boost`,
        titleAr: `الإيرادات أقل ${pct(delta)} — فرصة للتعزيز`,
        description: 'A slight dip vs the previous period. A limited-time offer could close the gap.',
        descAr: 'انخفاض طفيف مقارنة بالفترة السابقة. عرض محدود المدة قد يسد الفجوة.',
      })
    } else if (delta >= 20) {
      out.push({
        type: 'achievement', severity: 'medium',
        title:  `Revenue up ${sign(delta)}${pct(delta)} — excellent growth`,
        titleAr: `الإيرادات ارتفعت ${pct(delta)} — نمو ممتاز`,
        description: `Strong period. Revenue grew ${delta.toFixed(1)}% vs the previous window.`,
        descAr: `فترة قوية. نمت الإيرادات ${delta.toFixed(1)}% مقارنة بالفترة السابقة.`,
      })
    } else if (delta >= 5) {
      out.push({
        type: 'achievement', severity: 'low',
        title:  `Revenue up ${pct(delta)} vs last period`,
        titleAr: `الإيرادات ارتفعت ${pct(delta)} عن الفترة السابقة`,
        description: 'Steady growth. Keep up the current marketing and operations pace.',
        descAr: 'نمو ثابت. حافظ على وتيرة التسويق والعمليات الحالية.',
      })
    }
  }

  // ── Order volume change ─────────────────────────────────────────────────────
  if (metrics.prevOrderCount > 0 && metrics.orderCount > 0) {
    const delta = ((metrics.orderCount - metrics.prevOrderCount) / metrics.prevOrderCount) * 100
    if (delta <= -25) {
      out.push({
        type: 'alert', severity: 'medium',
        title:  `Order volume down ${pct(delta)}`,
        titleAr: `حجم الطلبات انخفض ${pct(delta)}`,
        description: 'Significantly fewer orders than the previous period. Review channel performance.',
        descAr: 'طلبات أقل بكثير من الفترة السابقة. راجع أداء قنوات التسويق.',
      })
    }
  }

  // ── AOV opportunity ─────────────────────────────────────────────────────────
  if (metrics.prevAvgOrderValue > 0) {
    const delta = ((metrics.avgOrderValue - metrics.prevAvgOrderValue) / metrics.prevAvgOrderValue) * 100
    if (delta >= 10) {
      out.push({
        type: 'achievement', severity: 'low',
        title:  `Avg order value up ${pct(delta)}`,
        titleAr: `متوسط قيمة الطلب ارتفع ${pct(delta)}`,
        description: 'Customers are spending more per order. Upselling and bundling are working.',
        descAr: 'العملاء ينفقون أكثر لكل طلب. استراتيجيات البيع الإضافي تعمل بشكل جيد.',
      })
    } else if (delta <= -10) {
      out.push({
        type: 'opportunity', severity: 'low',
        title:  `Avg order value down ${pct(delta)}`,
        titleAr: `متوسط قيمة الطلب انخفض ${pct(delta)}`,
        description: 'Consider introducing combo meals or minimum-order promotions to raise AOV.',
        descAr: 'فكر في تقديم وجبات مشتركة أو عروض حد أدنى للطلب لرفع متوسط القيمة.',
        action: 'Add bundle deals', actionAr: 'إضافة عروض الحزمة',
      })
    }
  }

  // ── Top seller ──────────────────────────────────────────────────────────────
  if (topItemNameEn) {
    out.push({
      type: 'info', severity: 'low',
      title:  `Top seller: ${topItemNameEn}`,
      titleAr: `الأكثر مبيعاً: ${topItemNameAr ?? topItemNameEn}`,
      description: 'Your #1 item this period. Ensure stock and prep capacity covers demand.',
      descAr: 'الصنف الأول هذه الفترة. تأكد من توفر المخزون وطاقة التحضير الكافية.',
    })
  }

  // ── Peak hour ───────────────────────────────────────────────────────────────
  if (peakHour !== null) {
    const hour12 = peakHour === 0 ? '12 AM'
      : peakHour < 12 ? `${peakHour} AM`
      : peakHour === 12 ? '12 PM'
      : `${peakHour - 12} PM`
    out.push({
      type: 'info', severity: 'low',
      title:  `Peak hour: ${hour12}`,
      titleAr: `ذروة الطلبات: الساعة ${peakHour}:00`,
      description: 'Ensure full kitchen and delivery coverage during this window.',
      descAr: 'تأكد من توفر طاقم المطبخ والتوصيل الكامل خلال هذه الساعة.',
    })
  }

  return out.slice(0, 5)
}
