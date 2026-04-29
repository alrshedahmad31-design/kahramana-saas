'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

export default function NarrativeSection({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('story.narrative')

  return (
    <section className="relative py-24 sm:py-32 bg-brand-black overflow-hidden">
      {/* Soft Background Glow */}
      <div 
        className="absolute top-0 start-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-gold/5 blur-[120px] rounded-full"
        aria-hidden="true"
      />

      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <p className="font-satoshi text-brand-gold text-xs font-bold tracking-[0.3em] uppercase mb-6">
            {t('eyebrow')}
          </p>
          <h2 className={`text-3xl sm:text-5xl font-bold text-brand-text mb-12 ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
            {t('title')}
          </h2>
        </motion.div>

        <div className={`space-y-12 text-lg sm:text-xl text-brand-muted leading-relaxed ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {t('p1')}
          </motion.p>

          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: 'circOut' }}
            className="h-px w-24 bg-brand-gold/30 mx-auto" 
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {t('p2')}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-brand-text font-medium"
          >
            {t('p3')}
          </motion.p>
        </div>
      </div>
    </section>
  )
}
