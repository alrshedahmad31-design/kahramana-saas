'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

interface Branch {
  id: string
  name_ar: string
  name_en: string | null
}

interface Props {
  branches: Branch[]
  locale: string
}

export default function OnboardingAlerts({ branches, locale }: Props) {
  const t = useTranslations('dashboard.onboarding')
  const isAr = locale === 'ar'
  
  const incompleteBranches = branches.filter(b => !b.name_en || b.name_en.trim() === '')
  
  if (incompleteBranches.length === 0) return null

  const title = t('title')
  const fixNow = t('fix_now')

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 mb-6"
      >
        {incompleteBranches.map((branch) => (
          <div
            key={branch.id}
            className="group relative overflow-hidden rounded-xl border border-brand-gold/30 bg-brand-surface p-4 shadow-sm"
          >
            {/* Subtle accent line */}
            <div className={`absolute top-0 bottom-0 w-1 bg-brand-gold ${isAr ? 'right-0' : 'left-0'}`} />
            
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 rounded-full bg-brand-gold/10 p-2 text-brand-gold">
                <AlertCircle size={20} />
              </div>
              
              <div className="flex-1">
                <h3 className="font-cairo text-sm font-bold text-brand-text">
                  {title}
                </h3>
                <p className="font-cairo text-xs text-brand-muted mt-1 leading-relaxed">
                  {t('missing_branch_en', { branch: branch.name_ar })}
                </p>
              </div>
              
              <div className="flex items-center">
                <Link
                  href={`/${locale}/dashboard/settings/branches`}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-gold/10 px-4 py-2 font-cairo text-xs font-bold text-brand-gold hover:bg-brand-gold hover:text-brand-black transition-all duration-200"
                >
                  {fixNow}
                  {isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                </Link>
              </div>
            </div>
            
            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-brand-gold/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}
