'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SectionHeader from '@/components/ui/SectionHeader'

gsap.registerPlugin(ScrollTrigger)

export default function PhilosophyManifesto() {
  const t = useTranslations('home.philosophy')
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray('.reveal-word')
      
      gsap.from(words, {
        opacity: 0.1,
        y: 20,
        stagger: 0.05,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          end: 'bottom 40%',
          scrub: true,
        }
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const standard = t('standard')
  const kahramana = t('kahramana')

  return (
    <section
      ref={sectionRef}
      className="py-32 px-6 sm:px-16 bg-brand-black relative overflow-hidden flex flex-col items-center text-center"
    >
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 overflow-hidden grayscale">
          <Image
            src="/assets/hero/hero-poster.webp"
            alt=""
            fill
            loading="lazy"
            className="object-cover object-center"
            sizes="100vw"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black via-transparent to-brand-black" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <SectionHeader 
          title={kahramana}
          subtitle={t('eyebrow')}
        />

        <div className="flex flex-col gap-8 sm:gap-16">
          <span className="text-xl sm:text-3xl text-brand-muted opacity-80 leading-relaxed max-w-2xl mx-auto">
            {standard.split(' ').map((word, i) => (
              <span key={i} className="reveal-word inline-block mx-1">{word}</span>
            ))}
          </span>
        </div>
      </div>
    </section>
  )
}
