'use client'

import { motion } from 'framer-motion'

interface Props {
  isAr: boolean
  badge: string
  title: string
  description: string
}

export default function BranchesHero({ isAr, badge, title, description }: Props) {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 inset-x-0 h-full -z-10">
        <div className="absolute inset-0 bg-brand-black" />
        <div className="absolute inset-0 opacity-40 bg-[url('/images/ui/mesh-gradient.png')] bg-cover bg-center" />
        <div className="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-brand-black to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className={`flex flex-col items-start text-start`}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className={`inline-block px-4 py-1.5 rounded-full bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-[10px] font-black uppercase tracking-[0.2em] mb-6 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {badge}
            </span>
            <h1 className={`text-5xl md:text-7xl font-black text-brand-text mb-6 leading-[1.1] ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {title}
            </h1>
            <p className={`max-w-2xl text-lg md:text-xl text-brand-muted leading-relaxed ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {description}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
