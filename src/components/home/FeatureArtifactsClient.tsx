'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { colors } from '@/lib/design-tokens'
import LuxuryIcon from '@/components/icons/LuxuryIcon'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MenuShufflerProps {
  locale: 'ar' | 'en'
  isRTL: boolean
}

export interface TelemetryFeedProps {
  steps: string[]
  isRTL: boolean
}

export interface PrivacyFeaturesProps {
  features: string[]
}

// ── Menu Vault shuffler ───────────────────────────────────────────────────────

const MENU_ITEMS = [
  { name: 'Quzi',    nameAr: 'قوزي شيف',   image: '/assets/gallery/slow-cooked-lamb-quzi.webp' },
  { name: 'Kabab',   nameAr: 'كباب بغدادي', image: '/assets/gallery/charcoal-lamb-kebab.webp' },
  { name: 'Masgouf', nameAr: 'سمك مسكوف',  image: '/assets/gallery/iraqi-masgouf.webp' },
]

export function MenuShuffler({ locale, isRTL }: MenuShufflerProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % MENU_ITEMS.length), 4000)
    return () => clearInterval(timer)
  }, [])

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
          <Image
            src={MENU_ITEMS[index].image}
            alt={locale === 'ar' ? MENU_ITEMS[index].nameAr : MENU_ITEMS[index].name}
            fill
            sizes="(max-width: 768px) 176px, 176px"
            quality={75}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-4 inset-x-0 px-2 text-center z-10">
            <span className="text-white font-black text-lg leading-tight drop-shadow-lg block">
              {MENU_ITEMS[index].name}
            </span>
            <span className="text-brand-gold font-bold text-sm leading-tight drop-shadow-md block font-cairo">
              {MENU_ITEMS[index].nameAr}
            </span>
          </div>
        </motion.div>

        <motion.div
          key={`bg-${index}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`absolute inset-0 bg-brand-gold/10 rounded-2xl -z-10 translate-y-3 blur-sm ${isRTL ? '-translate-x-3' : 'translate-x-3'}`}
        />
      </AnimatePresence>
    </div>
  )
}

// ── System telemetry feed ─────────────────────────────────────────────────────

export function TelemetryFeed({ steps, isRTL }: TelemetryFeedProps) {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(
      () => setVisibleCount((prev) => (prev < steps.length ? prev + 1 : 1)),
      1500,
    )
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
              color: isVisible ? colors.gold : colors.text,
            }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between gap-4 border-b border-white/5 pb-1"
          >
            <span className="text-[11px] font-medium tracking-tight">{step}</span>
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

// ── Privacy / seating feature carousel ───────────────────────────────────────

export function PrivacyFeatures({ features }: PrivacyFeaturesProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (features.length === 0) return
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
          <span className="text-brand-gold font-mono text-3xl mb-4">0{index + 1}</span>
          <p className="text-xl sm:text-2xl font-bold text-brand-text leading-tight font-cairo">
            {features[index]}
          </p>
          <div className="mt-8 w-12 h-[1px] bg-brand-gold/30" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-20">
        <div className="w-48 h-48 border border-brand-gold/20 rounded-full animate-pulse" />
        <div className="absolute w-64 h-64 border border-brand-gold/10 rounded-full animate-[spin_30s_linear_infinite]" />
      </div>
    </div>
  )
}
