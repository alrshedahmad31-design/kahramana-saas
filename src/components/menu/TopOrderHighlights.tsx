'use client'

import { motion } from 'framer-motion'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import type { NormalizedMenuItem } from '@/lib/menu'
import { Star } from 'lucide-react'

interface TopOrderHighlightsProps {
  items: NormalizedMenuItem[]
  locale: string
}

export default function TopOrderHighlights({ items, locale }: TopOrderHighlightsProps) {
  const isAr = locale === 'ar'
  const isRTL = isAr

  return (
    <section className="py-16 px-6 bg-brand-surface/20" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-2xl">
            <h2 className="font-cairo font-black text-brand-text text-3xl md:text-5xl leading-tight mb-4">
              {isAr ? 'الأطباق الأكثر طلباً في البحرين' : 'Most Ordered Dishes in Bahrain'}
            </h2>
            <p className="font-almarai text-brand-muted text-base md:text-lg">
              {isAr 
                ? 'استكشف المذاق العراقي الأصيل مع أطباقنا التي نالت إعجاب الجميع في الرفاع وقلالي.' 
                : 'Explore authentic Iraqi taste with our crowd-favorite dishes in Riffa and Qallali.'}
            </p>
          </div>
          <Link 
            href="/menu" 
            className="text-brand-gold font-bold hover:underline underline-offset-4 flex items-center gap-2"
          >
            {isAr ? 'عرض القائمة الكاملة' : 'View Full Menu'}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {items.slice(0, 3).map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group"
            >
              <Link href={`/menu/item/${item.slug}`} className="block relative aspect-[4/5] rounded-2xl overflow-hidden mb-6">
                <Image
                  src={item.image}
                  alt={isRTL ? `${item.name.ar} — كهرمانة بغداد` : `${item.name.en} — Kahramana Baghdad`}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-black/90 via-transparent to-transparent" />
                <div className="absolute bottom-6 start-6 end-6">
                   <div className="flex items-center gap-1 text-brand-gold mb-2">
                     <Star size={14} fill="currentColor" />
                     <Star size={14} fill="currentColor" />
                     <Star size={14} fill="currentColor" />
                     <Star size={14} fill="currentColor" />
                     <Star size={14} fill="currentColor" />
                   </div>
                   <h3 className="font-cairo font-black text-brand-text text-xl md:text-2xl">
                     {isRTL ? item.name.ar : item.name.en}
                   </h3>
                </div>
              </Link>
              <div className="font-almarai text-brand-muted text-sm leading-relaxed">
                {isRTL ? (
                  <>
                    يعد {item.name.ar} من أفضل <Link href="/menu" className="text-brand-gold hover:underline">المشويات العراقية</Link> في البحرين. اطلب الآن من فرعنا في <Link href="/branches" className="text-brand-gold hover:underline">الرفاع</Link> أو <Link href="/branches" className="text-brand-gold hover:underline">قلالي</Link>.
                  </>
                ) : (
                  <>
                    {item.name.en} is one of the best <Link href="/menu" className="text-brand-gold hover:underline">Iraqi Grills</Link> in Bahrain. Order now from our <Link href="/branches" className="text-brand-gold hover:underline">Riffa</Link> or <Link href="/branches" className="text-brand-gold hover:underline">Qallali</Link> branches.
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
