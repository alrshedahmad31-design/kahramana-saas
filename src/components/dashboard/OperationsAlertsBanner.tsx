'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { markAlertRead } from '@/app/[locale]/dashboard/alerts/actions'
import type { OperationsAlertRow } from '@/lib/supabase/custom-types'

interface Props {
  alerts: OperationsAlertRow[]
  locale: string
}

const MAX_VISIBLE = 3

function hoursAgo(iso: string): number {
  const diffMs = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(diffMs / 3_600_000))
}

function severityStyles(severity: string): string {
  if (severity === 'critical') {
    return 'border-brand-error/40 bg-brand-error/5'
  }
  return 'border-brand-gold/30 bg-brand-gold/10'
}

function severityIconClass(severity: string): string {
  return severity === 'critical' ? 'text-brand-error' : 'text-brand-gold'
}

function refLink(
  alert: OperationsAlertRow,
  locale: string,
): string | null {
  if (alert.ref_table === 'orders' && alert.ref_id) {
    return `/${locale}/dashboard/orders/${alert.ref_id}`
  }
  return null
}

function alertHref(alert: OperationsAlertRow, locale: string): string | null {
  return refLink(alert, locale)
}

export default function OperationsAlertsBanner({ alerts, locale }: Props) {
  const t = useTranslations('operationsAlerts')
  const isAr = locale === 'ar'
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const visible = alerts.filter((a) => !dismissed.has(a.id))
  if (visible.length === 0) return null

  const shown = visible.slice(0, MAX_VISIBLE)
  const overflow = visible.length - shown.length

  const handleDismiss = (alertId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(alertId)
      return next
    })
    startTransition(async () => {
      const result = await markAlertRead(alertId, locale)
      if (!result.ok) {
        setDismissed((prev) => {
          const next = new Set(prev)
          next.delete(alertId)
          return next
        })
      }
    })
  }

  return (
    <section
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex flex-col gap-3"
      aria-label={t('title')}
    >
      <div className="flex items-center gap-3">
        <h2 className="font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider">
          {t('title')}
        </h2>
        <div className="flex-1 h-px bg-brand-border" />
      </div>

      <div className="flex flex-col gap-2">
        {shown.map((alert) => {
          const href = alertHref(alert, locale)
          const hours = hoursAgo(alert.created_at)
          return (
            <div
              key={alert.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border ${severityStyles(alert.severity)}`}
            >
              <div className={`shrink-0 ${severityIconClass(alert.severity)}`}>
                <Icon name="warning" size={20} />
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm text-brand-text ${isAr ? 'font-cairo text-end' : 'font-satoshi text-start'}`}>
                  {alert.message}
                </p>
                <p className={`text-[11px] text-brand-muted mt-1 ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                  {t('hoursAgo', { hours })}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {href && (
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-surface/60 px-3 py-1.5 text-xs font-bold text-brand-gold hover:bg-brand-gold hover:text-brand-black transition-colors"
                  >
                    {t('viewOrder')}
                    <Icon name={isAr ? 'arrow-left' : 'arrow-right'} size={12} />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => handleDismiss(alert.id)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-bold text-brand-text hover:bg-brand-border/40 disabled:opacity-50 transition-colors"
                  aria-label={t('dismiss')}
                >
                  <Icon name="check" size={12} />
                  {t('dismiss')}
                </button>
              </div>
            </div>
          )
        })}

        {overflow > 0 && (
          <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {t('andMore', { count: overflow })}
          </p>
        )}
      </div>
    </section>
  )
}
