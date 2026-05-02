'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { MapPin } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import SectionHeader from '@/components/ui/SectionHeader'

export default function BranchesSection({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('story.branches')

  return (
    <section className="py-24 sm:py-32 bg-brand-surface relative overflow-hidden">
      {/* Decorative Gradient */}
      <div 
        className="absolute bottom-0 end-0 w-96 h-96 bg-brand-gold/5 blur-[100px] rounded-full translate-x-1/2 translate-y-1/2" 
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-16 text-center">
        <SectionHeader 
          title={t('title')}
          subtitle={t('eyebrow')}
          align="center"
          className="!mb-6"
        />
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className={`text-xl text-brand-muted max-w-2xl mx-auto mb-16 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}
        >
          {t('desc')}
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Riffa */}
          <BranchCard 
            title={isRTL ? 'الرفاع — الحجيات' : 'Riffa — Al-Hijiyat'}
            isRTL={isRTL}
            delay={0.1}
          />
          {/* Qallali */}
          <BranchCard 
            title={isRTL ? 'المحرق — قلالي' : 'qallali — Qallali'}
            isRTL={isRTL}
            delay={0.2}
          />
          {/* Budaiya */}
          <BranchCard 
            title={isRTL ? 'البديع (قريباً)' : 'Budaiya (Soon)'}
            isRTL={isRTL}
            isSoon
            delay={0.3}
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-16"
        >
          <Link
            href="/branches"
            className="inline-flex items-center gap-3 text-brand-gold hover:text-brand-gold-light transition-colors font-bold tracking-widest uppercase text-xs sm:text-sm"
          >
            <MapPin className="w-4 h-4" />
            <span>{isRTL ? 'اكتشف مواقعنا بالتفصيل' : 'Explore Our Locations'}</span>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

function BranchCard({ title, isRTL, isSoon, delay }: { title: string, isRTL: boolean, isSoon?: boolean, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      className={`p-8 bg-brand-black border border-white/5 rounded-3xl relative overflow-hidden group`}
    >
      <div className={`text-2xl font-bold ${isSoon ? 'text-brand-muted' : 'text-brand-text'} ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
        {title}
      </div>
      {!isSoon && (
        <div className="absolute top-4 end-4 w-2 h-2 bg-brand-gold rounded-full animate-pulse" />
      )}
      <div className={`mt-4 h-px w-0 group-hover:w-full bg-brand-gold/20 transition-all duration-700 mx-auto`} />
    </motion.div>
  )
}
