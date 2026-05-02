'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Link } from '@/i18n/navigation'

gsap.registerPlugin(ScrollTrigger)

interface Props {
  branchName: string
  description: string
  branchId: string
  isAr: boolean
}

const BRANCH_IMAGES: Record<string, string> = {
  riffa: '/assets/branches/riffa-hajiyat-branch.webp',
  qallali: '/assets/branches/muharraq-galali-branch.webp',
  badi: '/assets/branches/riffa-hajiyat-branch.webp', // fallback
}

export default function BranchHero({ branchName, description, branchId, isAr }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax effect
      gsap.to(imageRef.current, {
        y: '15%',
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })

      // Staggered reveals
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.2 } })
      
      tl.from('.branch-back', { opacity: 0, x: isAr ? 20 : -20, delay: 0.2 })
        .from('.branch-eyebrow', { opacity: 0, y: 20 }, '-=0.8')
        .from('.branch-title', { opacity: 0, y: 30, scale: 0.98 }, '-=0.8')
        .from('.branch-desc', { opacity: 0, y: 20 }, '-=0.8')
    }, containerRef.current || undefined)

    return () => ctx.revert()
  }, [isAr])

  return (
    <section 
      ref={containerRef}
      className="relative h-[70dvh] min-h-[500px] w-full overflow-hidden flex items-end pb-16 px-6 sm:px-16"
    >
      {/* Background Media */}
      <div className="absolute inset-0 z-0">
        <div ref={imageRef} className="absolute inset-0 w-full h-full scale-110">
          <Image
            src={BRANCH_IMAGES[branchId] || BRANCH_IMAGES.riffa}
            alt={branchName}
            fill
            priority
            className="object-cover"
          />
        </div>
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/60 to-transparent" />
        <div className="absolute inset-0 bg-brand-black/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto text-start">
        <Link
          href="/branches"
          className={`branch-back inline-flex items-center gap-2 text-brand-muted hover:text-brand-gold text-sm font-bold mb-8 transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={isAr ? 'rotate-180' : ''}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {isAr ? 'جميع الفروع' : 'All Branches'}
        </Link>

        <p className={`branch-eyebrow text-brand-gold text-xs font-bold tracking-[0.3em] uppercase mb-4 opacity-80 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'فرع' : 'Branch'}
        </p>

        <h1 
          className={`
            branch-title text-5xl sm:text-7xl font-black text-brand-text mb-6
            ${isAr ? 'font-cairo' : 'font-editorial'}
          `}
        >
          {branchName}
        </h1>

        <p 
          className={`
            branch-desc text-brand-muted text-lg sm:text-xl max-w-2xl leading-relaxed
            ${isAr ? 'font-almarai' : 'font-satoshi'}
          `}
        >
          {description}
        </p>
      </div>

      {/* Luxury Detail */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent" />
    </section>
  )
}
