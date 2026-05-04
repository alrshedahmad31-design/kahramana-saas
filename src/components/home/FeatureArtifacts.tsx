import { getLocale, getTranslations } from 'next-intl/server'
import dynamic from 'next/dynamic'
import CinematicButton from '@/components/ui/CinematicButton'
import type { MenuShufflerProps, TelemetryFeedProps, PrivacyFeaturesProps } from './FeatureArtifactsClient'

// Lazy-load the animated parts as a separate JS chunk.
// No ssr:false — the server renders each component's initial state so the
// card shells are fully visible before JS loads. Animations hydrate after.
const MenuShuffler = dynamic<MenuShufflerProps>(
  () => import('./FeatureArtifactsClient').then((m) => ({ default: m.MenuShuffler })),
)

const TelemetryFeed = dynamic<TelemetryFeedProps>(
  () => import('./FeatureArtifactsClient').then((m) => ({ default: m.TelemetryFeed })),
)

const PrivacyFeatures = dynamic<PrivacyFeaturesProps>(
  () => import('./FeatureArtifactsClient').then((m) => ({ default: m.PrivacyFeatures })),
)

export default async function FeatureArtifacts() {
  const locale = (await getLocale()) as 'ar' | 'en'
  const isRTL = locale === 'ar'

  const t          = await getTranslations('home.features')
  const telemetryT = await getTranslations('home.features.telemetry')
  const proximityT = await getTranslations('home.features.proximity')

  const telemetrySteps   = (telemetryT.raw('steps')    ?? []) as string[]
  const privacyFeatures  = (proximityT.raw('features') ?? []) as string[]

  return (
    <section className="py-20 px-6 sm:px-16 max-w-7xl mx-auto overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Artifact 1: The Menu Vault */}
        <div className="group relative glass-surface rounded-premium p-8 h-[450px] flex flex-col justify-between overflow-hidden">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-brand-gold uppercase mb-4 block">
              {t('vault.eyebrow')}
            </span>
            <h2 className={`text-2xl font-bold mb-4 ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
              {t('vault.title')}
            </h2>
            <p className="text-sm text-brand-muted leading-relaxed">
              {t('vault.desc')}
            </p>
          </div>

          <div className="relative flex-1 flex items-center justify-center">
            <MenuShuffler locale={locale} isRTL={isRTL} />
          </div>

          <CinematicButton
            href="/menu"
            isRTL={isRTL}
            className="mt-6 w-full py-4 text-xs font-bold rounded-full"
          >
            {t('vault.link')}
          </CinematicButton>
        </div>

        {/* Artifact 2: System Telemetry */}
        <div className="group relative glass-surface rounded-premium p-8 h-[450px] flex flex-col justify-between overflow-hidden">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-brand-gold uppercase mb-4 block">
              {t('telemetry.eyebrow')}
            </span>
            <h2 className={`text-2xl font-bold mb-4 ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
              {t('telemetry.title')}
            </h2>
          </div>

          <div className="flex-1 bg-brand-black/40 rounded-xl p-4 font-mono text-[10px] sm:text-xs text-brand-gold overflow-hidden relative">
            <div className="absolute top-2 end-4 flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
              <span className="text-[8px] uppercase opacity-80 tracking-tighter">
                {t('telemetry.liveFeed')}
              </span>
            </div>
            <TelemetryFeed steps={telemetrySteps} isRTL={isRTL} />
          </div>

          <div className="mt-6">
            <p className="text-xs text-brand-muted mb-4 leading-relaxed">
              {t('telemetry.desc')}
            </p>
            <CinematicButton
              href="/menu"
              isRTL={isRTL}
              className="w-full py-4 text-xs font-bold rounded-full"
            >
              {t('telemetry.link')}
            </CinematicButton>
          </div>
        </div>

        {/* Artifact 3: Privacy & Seating */}
        <div className="group relative glass-surface rounded-premium p-8 h-[450px] flex flex-col justify-between overflow-hidden">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-brand-gold uppercase mb-4 block">
              {t('proximity.eyebrow')}
            </span>
            <h2 className={`text-2xl font-bold mb-4 ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
              {t('proximity.title')}
            </h2>
          </div>

          <div className="relative flex-1 flex items-center justify-center">
            <PrivacyFeatures features={privacyFeatures} />
          </div>

          <div className="mt-6">
            <CinematicButton
              href={isRTL ? '/branches' : '/en/branches'}
              isRTL={isRTL}
              className="w-full py-4 text-xs font-bold rounded-full"
            >
              {t('proximity.link')}
            </CinematicButton>
          </div>
        </div>

      </div>
    </section>
  )
}
