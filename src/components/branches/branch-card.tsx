'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Link } from '@/i18n/navigation'
import { Branch, buildWaOrderLink } from '@/constants/contact'
import { BranchMetadata } from '@/lib/branches'
import { isBranchOpen } from '@/lib/utils/time'
import BranchStatusBadge from './branch-status-badge'
import CinematicButton from '@/components/ui/CinematicButton'

interface Props {
  branch: Branch
  metadata: BranchMetadata
  isAr: boolean
  locale: string
  tViewOnMap: string
  tComingSoon: string
  tOrderWhatsApp: string
  tStatusActive: string
  tStatusPlanned: string
  tStatusOpen: string
  tStatusClosed: string
  detailHref?: string
}

export default function BranchCard({
  branch,
  metadata,
  isAr,
  locale,
  tViewOnMap,
  tComingSoon,
  tOrderWhatsApp,
  tStatusActive,
  tStatusPlanned,
  tStatusOpen,
  tStatusClosed,
  detailHref,
}: Props) {
  const waLink = buildWaOrderLink(branch.id, locale as 'ar' | 'en')
  const isPlanned = branch.status === 'planned'
  const isOpen = isBranchOpen(branch.hours.opens, branch.hours.closes)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group relative bg-brand-surface-2 border border-brand-border rounded-2xl overflow-hidden flex flex-col h-full hover:border-brand-gold/40 transition-all duration-500"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Image Section */}
      <div className="relative h-64 overflow-hidden">
        <Image
          src={metadata.imageUrl || '/images/branches/placeholder.jpg'}
          alt={isAr ? branch.nameAr : branch.nameEn}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black/80 via-transparent to-transparent" />
        
        <div className="absolute top-4 end-4">
          <BranchStatusBadge 
            status={branch.status} 
            isAr={isAr} 
            isOpen={isOpen}
            label={isPlanned ? tStatusPlanned : (isOpen ? tStatusOpen : tStatusClosed)}
          />
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 p-6 flex flex-col gap-4">
        <div>
          <h3 className={`text-2xl font-black text-brand-text mb-2 text-start ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? branch.nameAr : branch.nameEn}
          </h3>
          <p className={`text-brand-muted text-sm leading-relaxed text-start ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? metadata.descriptionAr : metadata.descriptionEn}
          </p>
        </div>

        {/* Features / Services */}
        <div className="flex flex-wrap gap-2 justify-start">
          {metadata.features.map((feature: { ar: string; en: string }, i: number) => (
            <span 
              key={i}
              className={`px-3 py-1 rounded-full bg-brand-surface-3 border border-brand-border text-[11px] font-bold text-brand-gold uppercase tracking-tighter ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              {isAr ? feature.ar : feature.en}
            </span>
          ))}
        </div>

        {/* Contact Info */}
        <div className="mt-auto pt-6 border-t border-brand-border flex flex-col gap-3">
          {/* Phone */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-surface-3 flex items-center justify-center text-brand-gold shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <a 
              href={`tel:${branch.phone}`}
              dir="ltr"
              className="text-brand-text font-satoshi font-bold text-sm hover:text-brand-gold transition-colors"
            >
              {branch.phone}
            </a>
          </div>

          {/* Hours */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-surface-3 flex items-center justify-center text-brand-gold shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <span className={`text-brand-muted text-sm text-start ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? branch.hours.ar : branch.hours.en}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-surface-3 flex items-center justify-center text-brand-gold shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <a 
              href={branch.mapsUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-brand-gold font-bold text-xs uppercase tracking-widest hover:underline text-start ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              {tViewOnMap}
            </a>
          </div>
        </div>

        {/* CTA */}
        <div className={`mt-4 flex flex-col gap-2`}>
          <CinematicButton
            href={isPlanned ? undefined : waLink}
            disabled={isPlanned}
            isRTL={isAr}
            className="w-full py-4 text-sm font-bold rounded-xl"
            variant={isPlanned ? 'secondary' : 'primary'}
          >
            {isPlanned ? tComingSoon : tOrderWhatsApp}
          </CinematicButton>
          {detailHref && !isPlanned && (
            <Link
              href={detailHref as '/'}
              className={`flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-brand-gold hover:border-brand-gold text-xs font-bold transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              {isAr ? 'تفاصيل الفرع' : 'Branch Details'}
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}
