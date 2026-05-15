import { getTranslations } from 'next-intl/server'
import { AlertTriangle } from 'lucide-react'

interface AnalyticsErrorStateProps {
  functionName?: string
}

export async function AnalyticsErrorState({ functionName }: AnalyticsErrorStateProps) {
  const t = await getTranslations('analytics.errorState')
  const showDebug = process.env.NODE_ENV !== 'production' && functionName

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-lg border border-brand-border bg-brand-surface">
      <div className="w-12 h-12 rounded-full bg-brand-bg flex items-center justify-center mb-3 border border-brand-border">
        <AlertTriangle size={20} className="text-brand-muted" />
      </div>
      <p className="font-cairo font-black text-brand-text text-base mb-1">
        {t('title')}
      </p>
      <p className="font-almarai text-brand-muted text-sm max-w-sm">
        {t('description')}
      </p>
      {showDebug ? (
        <p className="font-mono text-brand-muted/60 text-xs mt-3">
          {functionName}
        </p>
      ) : null}
    </div>
  )
}
