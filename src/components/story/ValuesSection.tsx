'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { 
  Heart, 
  Award, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  History 
} from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'

export default function ValuesSection({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('story.values')

  const icons = [Award, ShieldCheck, Sparkles, Heart, Users, History]

  const values = [
    { ...t.raw('v1'), icon: icons[0] },
    { ...t.raw('v2'), icon: icons[1] },
    { ...t.raw('v3'), icon: icons[2] },
    { ...t.raw('v4'), icon: icons[3] },
    { ...t.raw('v5'), icon: icons[4] },
    { ...t.raw('v6'), icon: icons[5] },
  ]

  return (
    <section className="py-24 sm:py-32 bg-brand-surface">
      <div className="max-w-7xl mx-auto px-6 sm:px-16">
        <div className="max-w-4xl">
          <SectionHeader 
            title={t('title')}
            subtitle={t('eyebrow')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {values.map((v, index) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className={`p-8 bg-brand-surface-2 border border-white/5 rounded-[2rem] text-center group hover:bg-brand-black transition-colors duration-500`}
            >
              <div className="w-14 h-14 bg-brand-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-gold transition-colors duration-500">
                <v.icon className="w-6 h-6 text-brand-gold group-hover:text-brand-black transition-colors duration-500" />
              </div>
              <h3 className={`text-xl font-bold text-brand-text mb-4 ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                {v.title}
              </h3>
              <p className={`text-brand-muted leading-relaxed ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {v.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
