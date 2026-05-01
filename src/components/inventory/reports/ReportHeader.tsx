import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  lastUpdated?: string
  actions?: ReactNode
  locale?: string
}

export default function ReportHeader({ title, description, lastUpdated, actions }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">{title}</h1>
        {description && (
          <p className="font-satoshi text-sm text-brand-muted mt-1">{description}</p>
        )}
        {lastUpdated && (
          <p className="font-satoshi text-xs text-brand-muted mt-1">
            آخر تحديث: {new Date(lastUpdated).toLocaleString('ar-IQ')}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
