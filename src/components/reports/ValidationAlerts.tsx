'use client'

import type { ValidationResult } from '@/lib/reports/validator'
import { Icon, type IconName } from '@/components/ui/Icon'

interface Props {
  validation: ValidationResult
  isAr:       boolean
}

const ICONS: Record<string, IconName> = {
  error:   'x',
  warning: 'warning',
  info:    'info',
}

const BG: Record<string, string> = {
  error:   'bg-brand-error/15 border-brand-error/40 text-brand-error',
  warning: 'bg-brand-gold-light/10 border-brand-gold-light/30 text-brand-gold-light',
  info:    'bg-brand-surface-2 border-brand-border text-brand-muted',
}

export default function ValidationAlerts({ validation, isAr }: Props) {
  if (validation.flags.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-success/10 border border-brand-success/30 text-brand-success text-sm">
        <Icon name="check" size={15} />
        <span className={isAr ? 'font-almarai' : 'font-satoshi'}>
          {isAr ? 'البيانات سليمة — جميع فحوصات الجودة اجتازت بنجاح' : 'Data quality verified — all checks passed'}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {validation.flags.map((flag, i) => (
        <div
          key={i}
          className={`flex items-start gap-2.5 px-4 py-2.5 rounded-lg border text-sm ${BG[flag.level] ?? BG.info}`}
        >
          <Icon name={ICONS[flag.level] ?? 'info'} size={15} className="mt-0.5 shrink-0" />
          <span className={isAr ? 'font-almarai' : 'font-satoshi'}>
            {flag.level === 'error'   ? (isAr ? 'خطأ: ' : 'Error: ')   : ''}
            {flag.level === 'warning' ? (isAr ? 'تنبيه: ' : 'Warning: ') : ''}
            {flag.message}
          </span>
        </div>
      ))}
    </div>
  )
}
