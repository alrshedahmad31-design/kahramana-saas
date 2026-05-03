'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { colors } from '@/lib/design-tokens'
import CinematicButton from '@/components/ui/CinematicButton'
import LuxuryIcon from '@/components/icons/LuxuryIcon'

export default function FeatureArtifacts() {
  const locale = useLocale()
  const isRTL = locale === 'ar'
  const t = useTranslations('home.features')

  return (
    <section className="py-20 px-6 sm:px-16 max-w-7xl mx-auto overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Artifact 1: The Menu Vault (Shuffler) */}
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
            <MenuShuffler isRTL={isRTL} />
          </div>

          <CinematicButton 
            href="/menu" 
            isRTL={isRTL}
            className="mt-6 w-full py-4 text-xs font-bold rounded-full"
          >
            {t('vault.link')}
          </CinematicButton>
        </div>

        {/* Artifact 2: System Telemetry (Typewriter) */}
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
                <span className="text-[8px] uppercase opacity-80 tracking-tighter">{t('telemetry.liveFeed')}</span>
             </div>
             <TelemetryFeed isRTL={isRTL} />
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
            <PrivacyFeatures />
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

function MenuShuffler({ isRTL }: { isRTL: boolean }) {
  const locale = useLocale()
  const [index, setIndex] = useState(0)
  const items = [
    { name: 'Quzi', nameAr: 'قوزي شيف', image: '/assets/gallery/slow-cooked-lamb-quzi.webp' },
    { name: 'Kabab', nameAr: 'كباب بغدادي', image: '/assets/gallery/charcoal-lamb-kebab.webp' },
    { name: 'Masgouf', nameAr: 'سمك مسكوف', image: '/assets/gallery/iraqi-masgouf.webp' },
  ]

  useEffect(() => {
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % items.length), 4000)
    return () => clearInterval(timer)
  }, [items.length])

  return (
    <div className="relative w-44 h-44">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, y: -10 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          className="absolute inset-0 rounded-2xl flex items-center justify-center overflow-hidden border border-brand-border/30 shadow-2xl"
        >
          {/* Real Food Image */}
          <Image
            src={items[index].image}
            alt={locale === 'ar' ? items[index].nameAr : items[index].name}
            fill
            sizes="(max-width: 768px) 176px, 176px"
            quality={75}
            className="object-cover"
          />
          
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <div className="absolute bottom-4 inset-x-0 px-2 text-center z-10">
            <span className="text-white font-black text-lg leading-tight drop-shadow-lg block">
              {items[index].name}
            </span>
            <span className="text-brand-gold font-bold text-sm leading-tight drop-shadow-md block font-cairo">
              {items[index].nameAr}
            </span>
          </div>
        </motion.div>
        
        {/* Layered effect */}
        <motion.div 
           key={`bg-${index}`}
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           className={`absolute inset-0 bg-brand-gold/10 rounded-2xl -z-10 translate-y-3 blur-sm
             ${isRTL ? '-translate-x-3' : 'translate-x-3'}`}
        />
      </AnimatePresence>
    </div>
  )
}

function TelemetryFeed({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('home.features.telemetry')
  const rawSteps = t.raw('steps')
  const steps = Array.isArray(rawSteps) ? rawSteps : []
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleCount((prev) => (prev < steps.length ? prev + 1 : 1))
    }, 1500)
    return () => clearInterval(timer)
  }, [steps.length])

  return (
    <div className="flex flex-col gap-3 py-2">
      {steps.map((step, idx) => {
        const isVisible = idx < visibleCount
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
            animate={{
              opacity: isVisible ? 1 : 0.55,
              x: isVisible ? 0 : isRTL ? 5 : -5,
              // colors.muted (#6B6560) fails WCAG AA on dark bg — use colors.text (#F5F5F5)
              color: isVisible ? colors.gold : colors.text
            }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between gap-4 border-b border-white/5 pb-1"
          >
            <span className="text-[11px] font-medium tracking-tight">
              {step}
            </span>
            <motion.span
              animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.5 }}
              transition={{ duration: 0.3 }}
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-brand-gold"
            >
              <LuxuryIcon name="check" size={14} />
            </motion.span>
          </motion.div>
        )
      })}
    </div>
  )
}

function PrivacyFeatures() {
  const t = useTranslations('home.features.proximity')
  const rawFeatures = t.raw('features')
  const features = Array.isArray(rawFeatures) ? rawFeatures : []
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % features.length), 3500)
    return () => clearInterval(timer)
  }, [features.length])

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 1.05 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center text-center px-4"
        >
          <span className="text-brand-gold font-mono text-3xl mb-4">
            0{index + 1}
          </span>
          <p className="text-xl sm:text-2xl font-bold text-brand-text leading-tight font-cairo">
            {features[index]}
          </p>
          <div className="mt-8 w-12 h-[1px] bg-brand-gold/30" />
        </motion.div>
      </AnimatePresence>
      
      {/* Abstract background elements */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-20">
        <div className="w-48 h-48 border border-brand-gold/20 rounded-full animate-pulse" />
        <div className="absolute w-64 h-64 border border-brand-gold/10 rounded-full animate-[spin_30s_linear_infinite]" />
      </div>
    </div>
  )
}
