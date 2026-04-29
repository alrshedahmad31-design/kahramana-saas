'use client'

import type { ValidationResult } from '@/lib/reports/validator'

interface Props {
  validation: ValidationResult
  isAr:       boolean
}

const ICONS: Record<string, string> = {
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
}

const BG: Record<string, string> = {
  error:   'bg-red-950/40 border-red-800/50 text-red-300',
  warning: 'bg-orange-950/40 border-orange-700/50 text-orange-300',
  info:    'bg-blue-950/40 border-blue-800/50 text-blue-300',
}

export default function ValidationAlerts({ validation, isAr }: Props) {
  if (validation.flags.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-sm">
        <span>✓</span>
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
          <span className="mt-0.5 shrink-0 font-bold">{ICONS[flag.level]}</span>
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
