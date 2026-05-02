'use client'

import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MapPin, Navigation } from 'lucide-react'
import { BRANCH_LIST } from '@/constants/contact'
import SectionHeader from '@/components/ui/SectionHeader'

gsap.registerPlugin(ScrollTrigger)

interface Props {
  isRTL: boolean
}

export default function ContactMaps({ isRTL }: Props) {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.map-card', {
        opacity: 0,
        y: 50,
        stagger: 0.2,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
        }
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const activeBranches = BRANCH_LIST.filter(b => b.status === 'active')

  return (
    <section ref={sectionRef} className="py-24 px-6 sm:px-16 bg-brand-black/50 backdrop-blur-sm border-y border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center text-center">
          <SectionHeader
            title={isRTL ? 'تفضل بزيارة فروعنا' : 'Visit Our Branches'}
            subtitle={isRTL ? 'مواقعنا' : 'Our Locations'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {activeBranches.map((branch) => (
            <div key={branch.id} className="map-card group relative">
              {/* Header Info */}
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold border border-brand-gold/20">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold text-brand-text ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                      {isRTL ? branch.nameAr : branch.nameEn}
                    </h3>
                    <p className="text-xs text-brand-muted uppercase tracking-widest mt-1">
                      {isRTL ? branch.cityAr : branch.cityEn}
                    </p>
                  </div>
                </div>
                {branch.mapsUrl && (
                  <a 
                    href={branch.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs font-bold text-brand-gold hover:text-white transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>{isRTL ? 'فتح في الخرائط' : 'Open in Maps'}</span>
                  </a>
                )}
              </div>

              {/* Map Iframe */}
              <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-700 group-hover:border-brand-gold/40">
                {branch.latitude && branch.longitude && (
                  <iframe
                    src={`https://www.google.com/maps?q=${branch.latitude},${branch.longitude}&z=16&output=embed`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="grayscale transition-all duration-1000 group-hover:grayscale-0 contrast-[1.1] brightness-[0.8] group-hover:brightness-100"
                  />
                )}
                
                {/* Overlay vignette */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-brand-black/40 to-transparent opacity-60" />
                
                {/* Corner Accents */}
                <div className="absolute top-0 start-0 w-8 h-8 border-t border-s border-brand-gold/40 rounded-tl-3xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <div className="absolute bottom-0 end-0 w-8 h-8 border-b border-e border-brand-gold/40 rounded-br-3xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
              </div>

              {/* Address subtext */}
              <p className="mt-4 px-2 text-sm text-brand-muted leading-relaxed">
                {isRTL ? branch.addressAr : branch.addressEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
