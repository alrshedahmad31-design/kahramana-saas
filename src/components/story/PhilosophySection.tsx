'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

export default function PhilosophySection({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('story.philosophy')

  return (
    <section className="relative min-h-[70vh] flex items-center py-24 bg-brand-surface overflow-hidden">
      {/* Decorative Text in background */}
      <div 
        className={`absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none overflow-hidden`}
        aria-hidden="true"
      >
        <span className={`text-[20vw] font-black whitespace-nowrap ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
          KAHRAMANA
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-16 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          <div className="lg:col-span-4">
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 30 : -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <p className="font-satoshi text-brand-gold text-xs font-bold tracking-[0.3em] uppercase mb-4">
                {t('eyebrow')}
              </p>
              <h2 className={`text-5xl sm:text-7xl font-bold text-brand-text leading-tight ${isRTL ? 'font-cairo' : 'font-editorial italic'}`}>
                {t('title')}
              </h2>
            </motion.div>
          </div>

          <div className="lg:col-span-8 lg:flex lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 }}
              className={`p-10 sm:p-16 border-s-2 border-brand-gold/30`}
            >
              <p className={`text-2xl sm:text-3xl lg:text-4xl text-brand-text/90 leading-relaxed font-light ${isRTL ? 'font-almarai' : 'font-editorial italic'}`}>
                {t('desc')}
              </p>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  )
}
