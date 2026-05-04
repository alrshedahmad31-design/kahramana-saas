import { getLocale, getTranslations } from 'next-intl/server'
import SectionHeader from '@/components/ui/SectionHeader'

export default async function PhilosophyManifesto() {
  const locale = await getLocale()
  const isRTL = locale === 'ar'
  const t = await getTranslations('home.philosophy')

  const standard = t('standard')
  const kahramana = t('kahramana')

  return (
    <section
      className="py-32 px-6 sm:px-16 bg-brand-black relative overflow-hidden flex flex-col items-center text-center"
    >
      {/* Background Texture */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-brand-gold/20 via-transparent to-brand-gold/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black via-transparent to-brand-black" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <SectionHeader 
          title={kahramana}
          subtitle={t('eyebrow')}
          isRTL={isRTL}
        />

        <div className="flex flex-col gap-8 sm:gap-16">
          <span className="text-xl sm:text-3xl text-brand-muted opacity-80 leading-relaxed max-w-2xl mx-auto">
            {standard.split(' ').map((word, i) => (
              <span key={i} className="inline-block mx-1">{word}</span>
            ))}
          </span>
        </div>
      </div>
    </section>
  )
}
