import { getTranslations } from 'next-intl/server'
import { CATERING_OCCASION_TYPES } from '@/lib/whatsapp-catering-message'

interface Props {
  locale:   'ar' | 'en'
  from?:    string
  to?:      string
  occasion?: string
}

export default async function CateringFilters({ locale, from, to, occasion }: Props) {
  const t     = await getTranslations('dashboard.catering')
  const isAr  = locale === 'ar'

  return (
    <form
      method="GET"
      className="bg-brand-surface border border-brand-border rounded-xl p-4 flex flex-col gap-3"
    >
      <p className={`text-[10px] uppercase tracking-wider font-bold text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {t('filters.title')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1 min-w-0">
          <span className={`text-xs font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('filters.from')}
          </span>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ''}
            className="bg-brand-black/40 border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:border-brand-gold/60 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 min-w-0">
          <span className={`text-xs font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('filters.to')}
          </span>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ''}
            className="bg-brand-black/40 border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:border-brand-gold/60 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 min-w-0">
          <span className={`text-xs font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('filters.occasion')}
          </span>
          <select
            name="occasion"
            defaultValue={occasion ?? ''}
            className="bg-brand-black/40 border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:border-brand-gold/60 focus:outline-none"
          >
            <option value="">{t('filters.occasionAll')}</option>
            {CATERING_OCCASION_TYPES.map((key) => (
              <option key={key} value={key}>
                {t(`occasionTypes.${key}`)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 min-h-[44px] bg-brand-gold text-brand-black font-bold rounded-lg px-4 text-sm hover:opacity-90 transition-opacity"
          >
            {t('filters.apply')}
          </button>
          <a
            href="?"
            className={`flex-1 min-h-[44px] flex items-center justify-center bg-brand-black/40 border border-brand-border text-brand-text font-bold rounded-lg px-4 text-sm hover:border-brand-gold/40 transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {t('filters.clear')}
          </a>
        </div>
      </div>
    </form>
  )
}
