'use client'

import { useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { PROTOCOL_COLORS } from '@/lib/design-tokens'

const PROTOCOLS = [
  {
    id: '01',
    color: PROTOCOL_COLORS.step1,
    image: '/assets/protocol/authenticity.webp'
  },
  {
    id: '02',
    color: PROTOCOL_COLORS.step2,
    image: '/assets/protocol/step-02-prepare.webp'
  },
  {
    id: '03',
    color: PROTOCOL_COLORS.step3,
    image: '/assets/protocol/step-03-cook.webp'
  },
  {
    id: '04',
    color: PROTOCOL_COLORS.step4,
    image: '/assets/protocol/step-04-serve.webp'
  }
]

export default function ProtocolStack() {
  const locale = useLocale()
  const isRTL = locale === 'ar'
  const t = useTranslations('home.protocol')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Lazy registration -- keeps ScrollTrigger out of the module-evaluation
    // critical path so it never mutates <html> style before first paint.
    gsap.registerPlugin(ScrollTrigger)

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray('.protocol-card') as HTMLElement[]
      
      cards.forEach((card, i) => {
        if (i === cards.length - 1) return

        ScrollTrigger.create({
          trigger: card,
          start: 'top top',
          pin: true,
          pinSpacing: false,
          scrub: true,
          end: 'bottom top',
          animation: gsap.timeline()
            .to(card, {
              scale: 0.9,
              opacity: 0.5,
              filter: 'blur(10px)',
              duration: 1,
              ease: 'power1.inOut'
            })
        })
      })
    }, containerRef.current || undefined)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={containerRef} className="relative bg-brand-black">
      <div className="sticky top-0 h-24 flex items-center justify-center z-40 bg-brand-black/80 backdrop-blur-md border-b border-white/5">
        <h2 className={`text-xs sm:text-sm font-bold uppercase tracking-[0.22em] text-brand-gold ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
          {t('title')}
        </h2>
      </div>

      <div className="flex flex-col">
        {PROTOCOLS.map((step) => (
          <div 
            key={step.id} 
            className="protocol-card h-screen w-full flex items-center justify-center p-6 sm:p-16 relative overflow-hidden"
          >
            {/* Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
               <Image 
                 src={step.image} 
                 alt={t(`steps.${step.id}.title` as 'steps.01.title' | 'steps.02.title' | 'steps.03.title' | 'steps.04.title')}
                 fill
                 className="object-cover opacity-20"
                 sizes="100vw"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/60 to-brand-black" />
            </div>

            <div className={`relative z-10 glass-surface rounded-premium p-8 sm:p-16 max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center`}>
              <div className={isRTL ? 'order-2' : 'order-1'}>
                <span className="font-mono text-brand-gold text-4xl sm:text-6xl mb-8 block opacity-50">
                  {step.id}
                </span>
                <h3 
                  className={`
                    text-4xl sm:text-6xl font-bold mb-8
                    ${isRTL ? 'font-cairo' : 'font-editorial'}
                  `}
                  style={{ color: step.color }}
                >
                  {t(`steps.${step.id}.title` as 'steps.01.title' | 'steps.02.title' | 'steps.03.title' | 'steps.04.title')}
                </h3>
                <p className="text-lg sm:text-xl text-brand-muted leading-relaxed">
                  {t(`steps.${step.id}.desc` as 'steps.01.desc' | 'steps.02.desc' | 'steps.03.desc' | 'steps.04.desc')}
                </p>
              </div>

              <div className={`relative h-64 sm:h-[400px] rounded-2xl overflow-hidden ${isRTL ? 'order-1' : 'order-2'}`}>
                 <Image src={step.image} fill className="object-cover" alt={t(`steps.${step.id}.title` as 'steps.01.title' | 'steps.02.title' | 'steps.03.title' | 'steps.04.title')} sizes="(max-width: 768px) 100vw, 50vw" />
                 <div className="absolute inset-0 ring-1 ring-white/10 rounded-2xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
