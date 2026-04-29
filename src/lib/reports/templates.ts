export type ReportCategory = 'financial' | 'operational' | 'customer' | 'marketing'

export type ReportType =
  | 'sales_summary'
  | 'menu_performance'
  | 'customer_clv'
  | 'coupon_performance'
  | 'operational_summary'

export interface ReportTemplate {
  id:          ReportType
  category:    ReportCategory
  title_ar:    string
  title_en:    string
  desc_ar:     string
  desc_en:     string
  icon:        string
  columns_ar:  string[]
  columns_en:  string[]
  available:   boolean
  locked?:     boolean
  lockedMsg?:  string
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  // ── Financial ─────────────────────────────────────────────────────────────
  {
    id:         'sales_summary',
    category:   'financial',
    title_ar:   'ملخص المبيعات',
    title_en:   'Sales Summary',
    desc_ar:    'الإيرادات والطلبات والمتوسطات حسب الفترة والفرع مع المقارنة بالفترة السابقة',
    desc_en:    'Revenue, orders and averages by period and branch with prior-period growth',
    icon:       'TrendingUp',
    columns_ar: ['التاريخ', 'الفرع', 'الطلبات', 'الإيراد (د.ب)', 'متوسط الطلب (د.ب)'],
    columns_en: ['Date', 'Branch', 'Orders', 'Revenue (BD)', 'Avg Order (BD)'],
    available:  true,
  },
  // ── Operational ───────────────────────────────────────────────────────────
  {
    id:         'menu_performance',
    category:   'operational',
    title_ar:   'أداء المنيو',
    title_en:   'Menu Performance',
    desc_ar:    'أكثر الأصناف مبيعاً والإيراد والربح التقديري لكل صنف',
    desc_en:    'Top-selling items, revenue and estimated profit per item',
    icon:       'UtensilsCrossed',
    columns_ar: ['الصنف (EN)', 'الصنف (AR)', 'الكمية', 'الطلبات', 'الإيراد (د.ب)', 'متوسط السعر (د.ب)', 'الربح التقديري (د.ب)'],
    columns_en: ['Item (EN)', 'Item (AR)', 'Units Sold', 'Orders', 'Revenue (BD)', 'Avg Price (BD)', 'Est. Profit (BD)'],
    available:  true,
  },
  {
    id:         'operational_summary',
    category:   'operational',
    title_ar:   'ملخص العمليات',
    title_en:   'Operational Summary',
    desc_ar:    'توزيع الطلبات بالساعة — يساعد في تحديد ساعات الذروة وتخطيط الموارد',
    desc_en:    'Order distribution by hour of day — identifies peak hours for resource planning',
    icon:       'Activity',
    columns_ar: ['الساعة', 'الطلبات', 'الإيراد (د.ب)', 'متوسط الطلب (د.ب)'],
    columns_en: ['Hour', 'Orders', 'Revenue (BD)', 'Avg Order (BD)'],
    available:  true,
  },
  // ── Customer ──────────────────────────────────────────────────────────────
  {
    id:         'customer_clv',
    category:   'customer',
    title_ar:   'قيمة العملاء مدى الحياة',
    title_en:   'Customer Lifetime Value',
    desc_ar:    'أفضل العملاء والشرائح ومتوسط قيمة الطلب مع تصنيف VIP',
    desc_en:    'Top customers, segments and order value with VIP classification',
    icon:       'Users',
    columns_ar: ['الهاتف', 'الاسم', 'الطلبات', 'الإجمالي (د.ب)', 'متوسط الطلب (د.ب)', 'أول طلب', 'آخر طلب', 'الشريحة'],
    columns_en: ['Phone', 'Name', 'Orders', 'Total (BD)', 'Avg Order (BD)', 'First Order', 'Last Order', 'Segment'],
    available:  true,
  },
  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    id:         'coupon_performance',
    category:   'marketing',
    title_ar:   'أداء الكوبونات',
    title_en:   'Coupon Performance',
    desc_ar:    'عائد الاستثمار والخصومات والإيرادات المُولَّدة لكل كوبون',
    desc_en:    'ROI, discounts given and revenue generated per coupon code',
    icon:       'Tag',
    columns_ar: ['الكود', 'النوع', 'الحملة', 'الاستخدامات', 'الإيراد (د.ب)', 'الخصم (د.ب)', 'الصافي (د.ب)', 'العائد %'],
    columns_en: ['Code', 'Type', 'Campaign', 'Uses', 'Revenue (BD)', 'Discount (BD)', 'Net (BD)', 'ROI %'],
    available:  true,
  },
]

export function getTemplatesByCategory(category: ReportCategory): ReportTemplate[] {
  return REPORT_TEMPLATES.filter((t) => t.category === category)
}

export function getTemplate(id: ReportType): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === id)
}

export const CATEGORY_META: Record<ReportCategory, { label_en: string; label_ar: string }> = {
  financial:   { label_en: 'Financial',   label_ar: 'المالية'     },
  operational: { label_en: 'Operational', label_ar: 'التشغيلية'   },
  customer:    { label_en: 'Customer',    label_ar: 'العملاء'      },
  marketing:   { label_en: 'Marketing',   label_ar: 'التسويق'      },
}
