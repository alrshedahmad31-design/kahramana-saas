'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

export default function FounderSection({ isRTL }: { isRTL: boolean }) {
  const t = useTranslations('story.founder')

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden bg-brand-black">
      {/* Background Decorative Element */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-gold/10 to-transparent" 
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Founder Image Container */}
          <motion.div 
            initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="relative"
          >
            <div className="relative aspect-[4/5] sm:aspect-[3/4] overflow-hidden rounded-[2rem] border border-brand-gold/20 group">
              <Image
                src="/assets/founder/founder.webp"
                alt={t('title')}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              {/* Cinematic Lighting Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-transparent opacity-60" />
              <div className="absolute inset-0 ring-1 ring-inset ring-brand-gold/20 rounded-[2rem]" />
            </div>

            {/* Signature Floating Effect */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="absolute -bottom-6 -end-6 bg-brand-surface/80 backdrop-blur-xl border border-brand-gold/20 p-6 rounded-2xl shadow-2xl"
            >
              <Image
                src="/assets/founder/founder-signature.webp"
                alt="Signature"
                width={140}
                height={60}
                className="object-contain brightness-125 contrast-125"
              />
              <p className={`text-[10px] uppercase tracking-widest text-brand-gold mt-2 text-center font-bold`}>
                {t('role')}
              </p>
            </motion.div>
          </motion.div>

          {/* Founder Text Content */}
          <div className={`${isRTL ? 'lg:pe-12' : 'lg:ps-12'}`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="font-satoshi text-brand-gold text-xs font-bold tracking-[0.3em] uppercase mb-4">
                {t('eyebrow')}
              </p>
              <h2 className={`text-4xl sm:text-5xl font-bold text-brand-text mb-8 ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
                {t('title')}
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative p-8 bg-brand-surface/40 backdrop-blur-sm rounded-[2rem] border border-white/5 mb-8"
            >
              <div className="absolute top-4 end-4 text-6xl text-brand-gold/20 font-serif leading-none">
                &ldquo;
              </div>
              <p className={`text-xl sm:text-2xl text-brand-text/90 italic leading-relaxed ${isRTL ? 'font-almarai' : 'font-editorial italic'}`}>
                {t('quote')}
              </p>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.4 }}
              className={`text-lg text-brand-muted leading-relaxed ${isRTL ? 'font-almarai' : 'font-satoshi'}`}
            >
              {t('vision')}
            </motion.p>
          </div>

        </div>
      </div>
    </section>
  )
}
