'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface Props {
  latitude: number
  longitude: number
  isAr: boolean
}

export default function BranchMap({ latitude, longitude, isAr }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.map-content', {
        opacity: 0,
        y: 40,
        duration: 1.2,
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top 80%',
        },
      })
    }, containerRef)

    return () => ctx.revert()
  }, [])

  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`

  return (
    <section ref={containerRef} className="py-24 px-6 sm:px-16 bg-brand-black">
      <div className="max-w-7xl mx-auto">
        <div className="map-content relative">
          <div className="flex flex-col mb-12">
            <h2 className={`text-3xl sm:text-5xl font-black text-brand-text mb-4 ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {isAr ? 'تفضل بزيارتنا' : 'Visit Us'}
            </h2>
            <div className="w-24 h-1 bg-brand-gold" />
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-brand-border bg-brand-surface-2 group">
            {/* Darkening Overlay (visual only) */}
            <div className="absolute inset-0 pointer-events-none z-10 bg-brand-black/10 mix-blend-multiply group-hover:bg-transparent transition-all duration-700" />
            
            <iframe
              src={mapUrl}
              width="100%"
              height="100%"
              style={{ border: 0, filter: 'grayscale(0.6) contrast(1.1) brightness(0.8) invert(0)' }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Branch Location"
              className="grayscale-[0.3] invert-[0.05] contrast-[1.1]"
            />

            {/* Frame accent */}
            <div className="absolute inset-4 border border-brand-gold/10 pointer-events-none rounded-2xl z-20" />
          </div>
        </div>
      </div>
    </section>
  )
}
