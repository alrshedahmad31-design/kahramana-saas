'use client'

import Image from 'next/image'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import SectionHeader from '@/components/ui/SectionHeader'

export default function FounderSection({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('story.founder')
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  })

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -50])
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 50])

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3
      }
    }
  }

  const itemFadeUp = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] } }
  }

  return (
    <section 
      ref={containerRef}
      className="relative py-32 md:py-48 overflow-hidden bg-brand-black"
    >
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -start-20 w-96 h-96 bg-brand-gold/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -end-20 w-96 h-96 bg-brand-gold/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-16 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">
          
          {/* Left/Right: Founder Image Column */}
          <motion.div 
            style={{ y: y1 }}
            className="lg:col-span-5 relative"
          >
            <div className="relative aspect-[4/5] md:aspect-[3/4] overflow-hidden rounded-[2.5rem] border border-white/10 group shadow-2xl">
              <Image
                src="/assets/founder/founder.webp"
                alt={t('title')}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
                sizes="(max-width: 1024px) 100vw, 40vw"
                priority
              />
              {/* Cinematic Lighting Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-transparent opacity-60" />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[2.5rem]" />
            </div>

            {/* Float Badge */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, x: isRTL ? -20 : 20 }}
              whileInView={{ opacity: 1, scale: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="absolute -bottom-8 -end-8 bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-3xl hidden md:block"
            >
              <p className="text-brand-gold text-xs font-bold tracking-[0.3em] uppercase mb-1">
                {t('signature')}
              </p>
              <div className="w-12 h-px bg-brand-gold/30 mb-3" />
              <p className="text-white/40 text-[10px] tracking-widest uppercase">
                {t('heritageLabel')}
              </p>
            </motion.div>
          </motion.div>

          {/* Right/Left: Content Column */}
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            style={{ y: y2 }}
            className={`lg:col-span-7 flex flex-col pt-8 ${isRTL ? 'lg:pe-12' : 'lg:ps-12'}`}
          >
            {/* Header Area */}
            <SectionHeader 
              title={t('title')}
              subtitle={t('eyebrow')}
            />

            {/* Description Paragraphs */}
            <div className="space-y-8 mb-16">
              <motion.p 
                variants={itemFadeUp}
                className="text-xl md:text-2xl text-brand-text leading-relaxed font-light text-justify"
              >
                {t('p1')}
              </motion.p>
              <motion.p 
                variants={itemFadeUp}
                className="text-lg md:text-xl text-brand-muted leading-relaxed text-justify"
              >
                {t('p2')}
              </motion.p>
              <motion.p 
                variants={itemFadeUp}
                className="text-lg md:text-xl text-brand-muted leading-relaxed text-justify"
              >
                {t('p3')}
              </motion.p>
            </div>

            {/* Quote Block */}
            <motion.div 
              variants={itemFadeUp}
              className="relative p-10 md:p-14 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-[3rem] border border-white/10 overflow-hidden group hover:border-brand-gold/30 transition-colors duration-500"
            >
              <div className="absolute top-8 end-8 text-7xl text-brand-gold/10 font-serif pointer-events-none group-hover:text-brand-gold/20 transition-colors duration-500">
                &ldquo;
              </div>
              <p className="text-2xl md:text-3xl text-white leading-snug font-medium italic mb-10 relative z-10">
                {t('quote')}
              </p>
              
              <div className="flex flex-col border-t border-white/10 pt-8 relative z-10">
                <div className="flex flex-col items-start gap-4">
                  <div className="flex flex-col">
                    <span className="text-lg md:text-xl font-bold text-brand-gold mb-1">
                      {t('signature')}
                    </span>
                    <span className="text-sm text-brand-muted uppercase tracking-widest">
                      {t('role')}
                    </span>
                  </div>
                  
                  {/* Digital Signature Image */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 1, duration: 1 }}
                    className="relative w-48 h-20 -mt-4 opacity-80 filter brightness-110 contrast-125"
                  >
                    <Image
                      src="/assets/founder/founder-signature.webp"
                      alt={t('signatureAlt')}
                      fill
                      className="object-contain"
                    />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
