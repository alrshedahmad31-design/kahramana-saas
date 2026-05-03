'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import SectionHeader from '@/components/ui/SectionHeader'

export default function HomeFAQ() {
  const t = useTranslations('home.faq')
  const locale = useLocale()
  const isRTL = locale === 'ar'
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const faqItems = [
    { key: 'authentic' },
    { key: 'grills' },
    { key: 'masgouf' },
    { key: 'families' },
    { key: 'delivery' },
    { key: 'events' },
    { key: 'locations' },
  ]

  return (
    <section className="py-32 px-6 sm:px-16 bg-brand-black relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent" />

      <div className="max-w-4xl mx-auto relative z-10">
        <SectionHeader 
          title={t('title')}
          subtitle={isRTL ? 'معلومات تهمك' : 'Key Information'}
          className="text-center flex flex-col items-center"
        />

        <div className="mt-16 space-y-4">
          {faqItems.map((item, index) => (
            <FAQItem 
              key={item.key}
              question={t(`items.${item.key}.q`)}
              answer={t(`items.${item.key}.a`)}
              isOpen={activeIndex === index}
              onToggle={() => setActiveIndex(activeIndex === index ? null : index)}
              isRTL={isRTL}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQItem({ 
  question, 
  answer, 
  isOpen, 
  onToggle,
  isRTL
}: { 
  question: string; 
  answer: string; 
  isOpen: boolean; 
  onToggle: () => void;
  isRTL: boolean;
}) {
  return (
    <div className="border border-brand-border/30 rounded-2xl overflow-hidden bg-brand-surface/20 backdrop-blur-sm transition-all duration-300 hover:border-brand-gold/30">
      <button
        onClick={onToggle}
        className="w-full px-8 py-6 flex items-center justify-between text-start gap-4 transition-colors hover:bg-brand-gold/5"
      >
        <span className={`text-lg font-bold text-brand-text leading-tight ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0 text-brand-gold opacity-60"
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-8 pb-8">
              <div className="h-px w-12 bg-brand-gold/30 mb-6" />
              <p className={`text-brand-muted leading-relaxed ${isRTL ? 'font-cairo text-base' : 'font-satoshi text-sm opacity-80'}`}>
                {answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
