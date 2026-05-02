'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import SectionHeader from '@/components/ui/SectionHeader'

export default function MilestonesSection({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('story.milestones')

  const milestones = [
    { ...t.raw('m1') },
    { ...t.raw('m2') },
    { ...t.raw('m3') },
  ]

  return (
    <section className="py-24 sm:py-32 bg-brand-black">
      <div className="max-w-7xl mx-auto px-6 sm:px-16">
        <SectionHeader 
          title={t('title')}
          subtitle={t('eyebrow')}
        />

        <div className="relative">
          {/* Vertical Line */}
          <div 
            className="absolute start-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-brand-gold/30 to-transparent hidden md:block" 
            aria-hidden="true"
          />

          <div className="space-y-16">
            {milestones.map((m, index) => (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                className={`relative flex flex-col md:flex-row items-center gap-8 ${
                  index % 2 === 0
                    ? isRTL ? '' : 'md:flex-row-reverse'
                    : isRTL ? 'md:flex-row-reverse' : ''
                }`}
              >
                {/* Connector Dot */}
                <div className="absolute start-1/2 -translate-x-1/2 w-4 h-4 bg-brand-black border-2 border-brand-gold rounded-full z-10 hidden md:block shadow-[0_0_10px_rgba(200,146,42,0.5)]" />

                {/* Content Side */}
                <div className="flex-1 w-full md:w-1/2">
                  <div className={`p-8 bg-brand-surface border border-white/5 rounded-[2rem] ${
                    index % 2 === 0 ? 'text-end' : 'text-start'
                  }`}>
                    <span className="text-3xl font-black text-brand-gold mb-2 block font-satoshi tabular-nums">
                      {m.year}
                    </span>
                    <h3 className={`text-2xl font-bold text-brand-text mb-4 ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                      {m.title}
                    </h3>
                    <p className={`text-brand-muted leading-relaxed ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                      {m.desc}
                    </p>
                  </div>
                </div>

                {/* Empty Side (Spacer) */}
                <div className="flex-1 hidden md:block" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
