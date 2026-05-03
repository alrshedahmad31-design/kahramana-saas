'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface Props {
  embedSrc?: string | null
  latitude?: number | null
  longitude?: number | null
  isAr: boolean
  mapTitle?: string
}

export default function BranchMap({ embedSrc, latitude, longitude, isAr, mapTitle }: Props) {
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

  const mapUrl = embedSrc ?? (latitude && longitude ? `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed` : null)

  if (!mapUrl) return null

  return (
    <section ref={containerRef} className="py-24 px-6 sm:px-16 bg-brand-black">
      <div className="max-w-7xl mx-auto">
        <div className="map-content relative">
          <div className="flex flex-col mb-12">
            <h2 className={`section-title ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {isAr ? 'تفضل بزيارتنا' : 'Visit Us'}
            </h2>
            <div className="mt-4 w-24 h-1 bg-brand-gold" />
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-brand-border bg-brand-surface-2 group">
            <iframe
              src={mapUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={mapTitle ?? (isAr ? 'خريطة الفرع' : 'Branch Map')}
              className="grayscale transition-all duration-1000 group-hover:grayscale-0 contrast-[1.1] brightness-[0.9] group-hover:brightness-100"
            />

            {/* Frame accent */}
            <div className="absolute inset-4 border border-brand-gold/10 pointer-events-none rounded-2xl z-20 group-hover:border-brand-gold/30 transition-colors duration-700" />
          </div>
        </div>
      </div>
    </section>
  )
}
