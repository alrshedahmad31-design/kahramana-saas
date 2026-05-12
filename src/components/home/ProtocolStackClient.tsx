'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ── SVG 1: Concentric rotating rings ─────────────────────────────────────────

function GeometricMotif({ color }: { color: string }) {
  const r1 = useRef<SVGGElement>(null)
  const r2 = useRef<SVGGElement>(null)
  const r3 = useRef<SVGGElement>(null)

  useEffect(() => {
    const [el1, el2, el3] = [r1.current, r2.current, r3.current]
    if (!el1 || !el2 || !el3) return
    gsap.to(el1, { rotation: 360,  ease: 'none', duration: 28, repeat: -1, svgOrigin: '100 100' })
    gsap.to(el2, { rotation: -360, ease: 'none', duration: 18, repeat: -1, svgOrigin: '100 100' })
    gsap.to(el3, { rotation: 360,  ease: 'none', duration: 12, repeat: -1, svgOrigin: '100 100' })
    return () => { gsap.killTweensOf(el1); gsap.killTweensOf(el2); gsap.killTweensOf(el3) }
  }, [])

  return (
    <svg viewBox="0 0 200 200" className="w-52 h-52 sm:w-64 sm:h-64" aria-hidden="true">
      <g ref={r1}>
        <circle cx="100" cy="100" r="88" fill="none" stroke={color} strokeWidth="0.6" strokeDasharray="14 5" opacity="0.55" />
        <circle cx="100" cy="12" r="4"   fill={color} />
      </g>
      <g ref={r2}>
        <circle cx="100" cy="100" r="62" fill="none" stroke={color} strokeWidth="0.6" strokeDasharray="9 7"  opacity="0.7" />
        <circle cx="100" cy="38" r="3"   fill={color} />
      </g>
      <g ref={r3}>
        <circle cx="100" cy="100" r="36" fill="none" stroke={color} strokeWidth="1"   strokeDasharray="5 9"  opacity="0.9" />
        <circle cx="100" cy="64" r="2"   fill={color} />
      </g>
      <circle cx="100" cy="100" r="5" fill={color} />
    </svg>
  )
}

// ── SVG 2: Laser scanner across a dot grid ────────────────────────────────────

function LaserGrid({ color }: { color: string }) {
  const scannerRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const el = scannerRef.current
    if (!el) return
    gsap.fromTo(el, { y: 0 }, { y: 178, ease: 'sine.inOut', duration: 2.5, repeat: -1, yoyo: true })
    return () => { gsap.killTweensOf(el) }
  }, [])

  const dots: React.ReactElement[] = []
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      dots.push(
        <circle key={`${row}-${col}`} cx={11 + col * 22} cy={11 + row * 22} r="1.5" fill={color} opacity="0.22" />,
      )
    }
  }

  return (
    <svg viewBox="0 0 200 200" className="w-52 h-52 sm:w-64 sm:h-64" aria-hidden="true">
      {dots}
      <g ref={scannerRef}>
        <rect x="0" y="7"  width="200" height="14" fill={color} opacity="0.07" rx="1" />
        <line x1="0" y1="11" x2="200" y2="11" stroke={color}   strokeWidth="1.5" opacity="0.85" />
        <line x1="0" y1="11" x2="200" y2="11" stroke="white"   strokeWidth="0.4" opacity="0.4" />
      </g>
    </svg>
  )
}

// ── SVG 3: EKG waveform via stroke-dashoffset ─────────────────────────────────

const EKG_PATH =
  'M0,40 L20,40 Q25,30 30,40 L40,40 L43,47 L47,5 L51,73 L56,40 L68,40 Q76,22 83,40 L108,40 ' +
  'L128,40 Q133,30 138,40 L148,40 L151,47 L155,5 L159,73 L164,40 L176,40 Q184,22 191,40 L216,40 ' +
  'L236,40 Q241,30 246,40 L256,40 L259,47 L263,5 L267,73 L272,40 L284,40 Q292,22 299,40 L324,40'

function EKGWaveform({ color }: { color: string }) {
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const el = pathRef.current
    if (!el) return
    const len = el.getTotalLength()
    gsap.set(el, { strokeDasharray: len, strokeDashoffset: len })
    gsap.to(el, { strokeDashoffset: 0, ease: 'none', duration: 2.2, repeat: -1 })
    return () => { gsap.killTweensOf(el) }
  }, [])

  return (
    <svg
      viewBox="0 0 324 80"
      className="w-64 h-20 sm:w-96 sm:h-24"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        ref={pathRef}
        d={EKG_PATH}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProtocolStep {
  id:    string
  title: string
  desc:  string
  color: string
}

interface Props {
  steps:  ProtocolStep[]
  isRTL:  boolean
  label:  string
}

const ANIMATIONS = [GeometricMotif, LaserGrid, EKGWaveform] as const

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProtocolStackClient({ steps, isRTL, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs     = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[]

      // Pin each card. Cards 1..n-1 use pinSpacing:false so they stack without
      // adding extra page height. The LAST card uses pinSpacing:true so the page
      // reserves one viewport-height past it before the next section enters;
      // without that, the following section scrolls under the still-pinned card.
      cards.forEach((card, i) => {
        const isLast = i === cards.length - 1
        gsap.set(card, { zIndex: i + 1 })
        ScrollTrigger.create({
          trigger:     card,
          start:       'top top',
          pin:         true,
          pinSpacing:  isLast,
        })
      })

      // As the next card scrolls into view, push the current one back
      cards.forEach((card, i) => {
        if (i >= cards.length - 1) return
        gsap.to(card, {
          scale:   0.9,
          opacity: 0.5,
          filter:  'blur(20px)',
          ease:    'none',
          scrollTrigger: {
            trigger: cards[i + 1],
            start:   'top bottom',
            end:     'top top',
            scrub:   true,
          },
        })
      })
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <section className="relative bg-brand-black">
      {/* Sticky eyebrow sits above everything, including GSAP-pinned (fixed) cards */}
      <div className="sticky top-0 z-[200] h-16 flex items-center justify-center bg-brand-black/80 backdrop-blur-md border-b border-white/5 pointer-events-none">
        <span className={`text-xs font-bold uppercase tracking-[0.22em] text-brand-gold ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
          {label}
        </span>
      </div>

      <div ref={containerRef}>
        {steps.map((step, i) => {
          const Animation = ANIMATIONS[i]
          return (
            <div
              key={step.id}
              ref={(el) => { cardRefs.current[i] = el }}
              className="h-screen w-full flex items-center justify-center p-6 sm:p-16 bg-brand-black will-change-transform"
            >
              <div className="glass-surface rounded-premium p-8 sm:p-14 max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 items-center">

                {/* Text */}
                <div className={isRTL ? 'order-2' : 'order-1'}>
                  <span
                    className="font-mono text-5xl sm:text-7xl mb-6 block"
                    style={{ color: step.color, opacity: 0.35 }}
                  >
                    {step.id}
                  </span>
                  <h3
                    className={`text-4xl sm:text-6xl font-bold mb-6 leading-tight ${isRTL ? 'font-cairo' : 'font-editorial'}`}
                    style={{ color: step.color }}
                  >
                    {step.title}
                  </h3>
                  <p className={`text-base sm:text-lg text-brand-muted leading-relaxed ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                    {step.desc}
                  </p>
                </div>

                {/* SVG animation */}
                <div className={`flex items-center justify-center ${isRTL ? 'order-1' : 'order-2'}`}>
                  <Animation color={step.color} />
                </div>

              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
