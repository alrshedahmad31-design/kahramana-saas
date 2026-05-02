import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { CATERING_FALLBACK_DISHES, getCateringSignatureDishes } from '@/lib/catering'
import SectionHeader from '@/components/ui/SectionHeader'

export default function SignatureDishes() {
  const t = useTranslations('catering.signature')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const dishes = getCateringSignatureDishes(isAr ? 'ar' : 'en')
  const hasDishes = dishes.length > 0

  return (
    <section className="bg-brand-surface/45 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeader 
          title={t('title')}
          subtitle={t('eyebrow')}
        />
        <p className={`mx-auto mb-12 max-w-3xl text-center text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('description')}
        </p>

        {hasDishes ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {dishes.slice(0, 6).map((dish) => (
              <article key={dish.id} className="overflow-hidden rounded-2xl border border-brand-border bg-brand-black/45">
                <div className="relative aspect-[4/3] bg-brand-surface-2">
                  {dish.imageUrl ? (
                    <Image
                      src={dish.imageUrl}
                      alt={dish.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(209,159,81,0.18),transparent_60%)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-black/80 to-transparent" />
                </div>
                <div className="p-5 text-start">
                  <h3 className={`text-lg font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                    {dish.title}
                  </h3>
                  {dish.description && (
                    <p className={`mt-3 line-clamp-3 text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {dish.description}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {CATERING_FALLBACK_DISHES.map((dish, index) => (
              <article key={dish} className="rounded-2xl border border-brand-border bg-brand-black/45 p-5">
                <span className="font-satoshi text-3xl font-light text-brand-gold/35">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className={`mt-5 text-lg font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {t(`fallback.${dish}.title`)}
                </h3>
              </article>
            ))}
          </div>
        )}

        <p className={`mt-6 text-xs leading-6 text-brand-muted/80 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('note')}
        </p>
      </div>
    </section>
  )
}
