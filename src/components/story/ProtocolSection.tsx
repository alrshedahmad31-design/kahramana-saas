'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

export default function ProtocolSection({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('story.protocol')

  const steps = [
    { id: '01', ...t.raw('step1') },
    { id: '02', ...t.raw('step2') },
    { id: '03', ...t.raw('step3') },
    { id: '04', ...t.raw('step4') },
  ]

  return (
    <section className="py-24 sm:py-32 bg-brand-black">
      <div className="max-w-7xl mx-auto px-6 sm:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className={`text-4xl sm:text-6xl font-bold text-brand-text ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
            {t('title')}
          </h2>
          <div className="h-1 w-24 bg-brand-gold mx-auto mt-8 rounded-full" />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative p-8 bg-brand-surface border border-white/5 rounded-3xl hover:border-brand-gold/30 transition-all duration-500"
            >
              <div className="text-5xl font-black text-brand-gold/10 mb-6 group-hover:text-brand-gold/20 transition-colors font-satoshi">
                {step.id}
              </div>
              <h3 className={`text-2xl font-bold text-brand-text mb-4 ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                {step.title}
              </h3>
              <p className={`text-brand-muted leading-relaxed ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {step.desc}
              </p>
              
              {/* Decorative Accent */}
              <div className="absolute bottom-6 end-6 w-8 h-8 rounded-full border border-brand-gold/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-1 h-1 bg-brand-gold rounded-full" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
