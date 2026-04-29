'use client'

import { useState } from 'react'
import type { CouponAnalyticsRow } from '@/lib/analytics/queries'
import { colors } from '@/lib/design-tokens'

interface Props {
  coupons:  CouponAnalyticsRow[]
  isRTL:    boolean
}

export default function CouponROITable({ coupons, isRTL }: Props) {
  const [showInactive, setShowInactive] = useState(false)
  const currency = isRTL ? 'د.ب' : 'BD'

  const visible = showInactive ? coupons : coupons.filter((c) => c.usage_count > 0 || c.is_active)

  if (!visible.length) {
    return (
      <p className={`text-sm text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
        {isRTL ? 'لا توجد كوبونات نشطة' : 'No coupons with usage yet'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className={`text-xs text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {visible.length} {isRTL ? 'كوبون' : 'coupons'}
        </p>
        <button
          type="button"
          onClick={() => setShowInactive(!showInactive)}
          className="text-xs font-satoshi text-brand-muted hover:text-brand-gold transition-colors"
        >
          {showInactive
            ? (isRTL ? 'إخفاء غير النشطة' : 'Hide unused')
            : (isRTL ? 'إظهار الكل' : 'Show all')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              {[
                isRTL ? 'الكود'           : 'Code',
                isRTL ? 'الاستخدامات'    : 'Uses',
                isRTL ? 'الإيرادات'      : 'Revenue',
                isRTL ? 'الخصم المُعطى'  : 'Discount Given',
                isRTL ? 'الإيرادات الصافية' : 'Net Revenue',
                isRTL ? 'عائد الاستثمار' : 'ROI',
                isRTL ? 'الحالة'          : 'Status',
              ].map((h, i) => (
                <th
                  key={i}
                  className={`pb-2 pt-1 px-3 text-xs font-medium text-brand-muted
                              ${isRTL ? 'font-almarai text-end' : 'font-satoshi text-start'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const roi    = c.roi_percent
              const roiPos = roi !== null && roi >= 0
              return (
                <tr key={c.id} className="border-b border-brand-border/40 hover:bg-brand-surface-2">
                  <td className="px-3 py-2.5">
                    <p className="font-satoshi font-bold text-brand-gold tracking-wide">{c.code}</p>
                    {c.campaign_name && (
                      <p className={`text-xs text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                        {c.campaign_name}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-satoshi tabular-nums text-brand-text text-center">
                    {c.usage_count}
                    {c.usage_limit && (
                      <span className="text-brand-muted text-xs">/{c.usage_limit}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-satoshi tabular-nums text-brand-text">
                    {c.revenue_with_coupon.toFixed(3)} {currency}
                  </td>
                  <td className="px-3 py-2.5 font-satoshi tabular-nums" style={{ color: colors.error }}>
                    -{c.total_discount_given.toFixed(3)} {currency}
                  </td>
                  <td className="px-3 py-2.5 font-satoshi tabular-nums font-semibold" style={{ color: colors.success }}>
                    {c.net_revenue.toFixed(3)} {currency}
                  </td>
                  <td className="px-3 py-2.5">
                    {roi !== null ? (
                      <span
                        className="text-xs font-satoshi font-bold tabular-nums px-2 py-0.5 rounded-md"
                        style={{
                          color:      roiPos ? colors.success : colors.error,
                          background: `${roiPos ? colors.success : colors.error}15`,
                        }}
                      >
                        {roiPos ? '+' : ''}{roi.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-xs text-brand-muted font-satoshi">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="text-xs font-satoshi font-medium px-2 py-0.5 rounded-md"
                      style={{
                        color:      c.is_active ? colors.success : colors.muted,
                        background: c.is_active ? `${colors.success}15` : `${colors.muted}15`,
                      }}
                    >
                      {c.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
