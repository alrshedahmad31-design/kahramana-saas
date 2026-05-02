'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import CinematicButton from '@/components/ui/CinematicButton'

export default function StoryCTA({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('story.cta')

  return (
    <section className="relative py-32 sm:py-48 bg-brand-black overflow-hidden flex items-center justify-center">
      {/* Cinematic Background */}
      <div 
        className="absolute inset-0 z-0 opacity-40"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(200,146,42,0.15)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 text-center max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className={`section-title !mx-auto !text-5xl sm:!text-7xl ${isRTL ? 'font-cairo' : 'font-editorial italic'}`}>
            {t('title')}
          </h2>
          <p className={`text-xl sm:text-2xl text-brand-muted mb-12 max-w-2xl mx-auto ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
            {t('desc')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex justify-center"
        >
          <CinematicButton
            href="/menu"
            isRTL={isRTL}
            className="px-12 py-5 font-black text-lg rounded-full"
          >
            {t('button')}
          </CinematicButton>
        </motion.div>
      </div>
    </section>
  )
}
