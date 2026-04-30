'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import CinematicButton from '@/components/ui/CinematicButton'
import type { Branch } from '@/constants/contact'
import type { BranchMetadata } from '@/lib/branches'

gsap.registerPlugin(ScrollTrigger)

interface Props {
  branch: Branch
  metadata: BranchMetadata
  isAr: boolean
  waLink: string
}

export default function BranchDetailsContent({ branch, metadata, isAr, waLink }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.info-card', {
        opacity: 0,
        y: 30,
        stagger: 0.2,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 85%',
        },
      })

      gsap.from('.cta-box', {
        opacity: 0,
        scale: 0.95,
        duration: 1.2,
        scrollTrigger: {
          trigger: '.cta-box',
          start: 'top 90%',
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={sectionRef} className="max-w-7xl mx-auto px-6 sm:px-16 -mt-20 relative z-20 pb-24">
      {/* ── Info Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        
        {/* Address Card */}
        <div className="info-card group flex flex-col justify-between p-8 rounded-3xl bg-brand-surface/40 backdrop-blur-xl border border-brand-border hover:border-brand-gold/40 transition-all duration-500 min-h-[280px]">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-brand-gold">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <h3 className={`text-brand-gold text-xs font-bold tracking-widest uppercase mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'الموقع' : 'Location'}
            </h3>
            <p className={`text-brand-text text-xl font-bold leading-snug ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? branch.addressAr : branch.addressEn}
            </p>
          </div>
          {branch.mapsUrl && (
            <a 
              href={branch.mapsUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-brand-gold font-bold text-sm hover:translate-x-2 transition-transform duration-300"
            >
              {isAr ? 'فتح في خرائط جوجل' : 'Open in Google Maps'}
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={isAr ? 'rotate-180' : ''}>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          )}
        </div>

        {/* Hours Card */}
        <div className="info-card group flex flex-col p-8 rounded-3xl bg-brand-surface/40 backdrop-blur-xl border border-brand-border hover:border-brand-gold/40 transition-all duration-500 min-h-[280px]">
          <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-brand-gold">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h3 className={`text-brand-gold text-xs font-bold tracking-widest uppercase mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'ساعات العمل' : 'Opening Hours'}
          </h3>
          <p className={`text-brand-text text-xl font-bold leading-snug mb-4 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? branch.hours.ar : branch.hours.en}
          </p>
          <div className="mt-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-success animate-pulse" />
            <span className="text-brand-muted text-xs font-bold">{isAr ? 'مفتوح الآن' : 'Open Now'}</span>
          </div>
        </div>

        {/* Contact Card */}
        <div className="info-card group flex flex-col p-8 rounded-3xl bg-brand-surface/40 backdrop-blur-xl border border-brand-border hover:border-brand-gold/40 transition-all duration-500 min-h-[280px]">
          <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-brand-gold">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 015.06 3h3a2 2 0 012 1.72 12.81 12.81 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </div>
          <h3 className={`text-brand-gold text-xs font-bold tracking-widest uppercase mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'للتواصل' : 'Contact'}
          </h3>
          <a href={`tel:${branch.phone}`} className="text-brand-text text-2xl font-black hover:text-brand-gold transition-colors mb-2">
            {branch.phone}
          </a>
          <p className="text-brand-muted text-xs font-bold tracking-wider uppercase">{isAr ? 'مكالمات مباشرة' : 'Direct Call'}</p>
          
          <div className="mt-auto pt-6 flex flex-wrap gap-2">
            {metadata.features.map((f, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-brand-gold/5 border border-brand-gold/10 text-[10px] font-bold text-brand-gold uppercase tracking-wider">
                {isAr ? f.ar : f.en}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* ── CTA Box ───────────────────────────────────────────────────── */}
      <div className="cta-box relative overflow-hidden rounded-[2.5rem] bg-brand-surface p-10 sm:p-16 border border-brand-border">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 blur-[100px] -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-gold/5 blur-[100px] -ml-32 -mb-32" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="max-w-lg text-center md:text-start">
            <h2 className={`text-3xl sm:text-5xl font-black text-brand-text mb-6 ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {isAr ? 'تذوق الأصالة اليوم' : 'Taste the Authenticity'}
            </h2>
            <p className={`text-brand-muted text-lg ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'ابدأ طلبك الآن وسنقوم بتحضيره بكل حب وعناية.' : 'Start your order now and we will prepare it with love and care.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <CinematicButton
              href={waLink}
              isRTL={isAr}
              className="px-10 py-5 rounded-2xl text-lg font-black"
            >
              {isAr ? 'اطلب عبر واتساب' : 'Order via WhatsApp'}
            </CinematicButton>
            <CinematicButton
              href="/menu"
              isRTL={isAr}
              variant="secondary"
              className="px-10 py-5 rounded-2xl text-lg font-bold"
            >
              {isAr ? 'تصفح المنيو' : 'Browse Menu'}
            </CinematicButton>
          </div>
        </div>
      </div>
    </div>
  )
}
