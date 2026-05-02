'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useTranslations } from 'next-intl'
import SectionHeader from '@/components/ui/SectionHeader'

export default function StoryHero({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('story.hero')
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start']
  })

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <section 
      ref={containerRef}
      className="relative h-[90dvh] w-full overflow-hidden flex items-center justify-center pt-20"
    >
      {/* Background Image with Parallax */}
      <motion.div 
        style={{ y }}
        className="absolute inset-0 z-0"
      >
        <Image
          src="/assets/brand/kahramana-baghdad-brand-heritage-emblem.webp" // Updated heritage emblem image
          alt="Kahramana Baghdad"
          fill
          sizes="100vw"
          className="object-cover scale-110"
          priority
        />
        {/* Overlays */}
        <div className="absolute inset-0 bg-brand-black/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-brand-black/40" />
      </motion.div>

      {/* Content */}
      <motion.div 
        style={{ opacity }}
        className="relative z-10 w-full max-w-5xl px-6"
      >
        <SectionHeader 
          title={t('title')}
          subtitle={t('eyebrow')}
        />

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className={`
            max-w-2xl mx-auto text-lg sm:text-xl text-brand-text/80 leading-relaxed
            ${isRTL ? 'font-almarai' : 'font-satoshi'}
          `}
        >
          {t('desc')}
        </motion.p>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-10 start-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
      >
        <div className="w-px h-16 bg-gradient-to-b from-brand-gold to-transparent" />
      </motion.div>
    </section>
  )
}
