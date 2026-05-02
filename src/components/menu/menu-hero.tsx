'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface MenuHeroProps {
  locale: string
  titleOverride?: string
  descriptionOverride?: string
}

export default function MenuHero({ locale, titleOverride, descriptionOverride }: MenuHeroProps) {
  const isRTL = locale === 'ar'

  return (
    <section className="relative h-[55vh] md:h-[60vh] lg:h-[65vh] w-full overflow-hidden bg-brand-black">
      {/* Background Media */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover object-[center_30%] opacity-60"
        poster="/assets/hero/hero-menu.webp"
      >
        <source src="/assets/hero/hero-menu.mp4" type="video/mp4" />
      </video>

      {/* Fallback Image (hidden when video plays or for older browsers) */}
      <div className="absolute inset-0 z-[-1]">
        <Image
          src="/assets/hero/hero-menu.webp"
          alt={isRTL ? 'قائمة كهرمانة بغداد - أطباق عراقية أصيلة' : 'Kahramana Baghdad Menu - Authentic Iraqi Dishes'}
          fill
          priority
          fetchPriority="high"
          className="object-cover object-[center_30%] opacity-60"
          sizes="100vw"
        />
      </div>

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/60 to-transparent" />

      {/* Content Container */}
      <div className="relative h-full flex flex-col items-center justify-center text-center px-6 pt-12">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-almarai text-brand-muted text-xs tracking-[0.2em] uppercase mb-4"
        >
          {isRTL ? 'اكتشف نكهات بغداد' : 'Discover the flavors of Baghdad'}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-cairo font-black text-brand-text text-[clamp(2.5rem,6vw,4rem)] leading-tight"
        >
          {titleOverride || (isRTL ? 'قائمة كهرمانة' : 'Kahramana Menu')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="font-almarai text-brand-muted text-base max-w-md mx-auto mt-4 leading-relaxed"
        >
          {descriptionOverride || (isRTL 
            ? 'أطباق عراقية أصيلة بحرص لتقديم تجربة لا تُنسى' 
            : 'Authentic Iraqi dishes carefully prepared to provide an unforgettable experience')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-8 flex items-center gap-2 font-satoshi tabular-nums text-brand-gold text-sm"
        >
          <span>168 {isRTL ? 'صنف' : 'Items'}</span>
          <span className="text-brand-muted">·</span>
          <span>16 {isRTL ? 'تصنيف' : 'Categories'}</span>
        </motion.div>

        {/* Scroll Cue */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-8 start-1/2 -translate-x-1/2 text-brand-gold cursor-pointer"
          onClick={() => {
            document.getElementById('menu-content')?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          <ChevronDown size={32} strokeWidth={1.5} />
        </motion.div>
      </div>
    </section>
  )
}
