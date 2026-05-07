'use client'

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

interface Card {
  num:   string
  title: string
  desc:  string
}

// CSS custom properties require a widened style type — no `any`, no `@ts-ignore`
type CardStyle = CSSProperties & Record<`--${string}`, string>

const CARDS: Card[] = [
  { num: '01', title: 'الأصالة',  desc: 'وصفات تتجاوز الزمن، تُحفظ بعناية الأمانة.' },
  { num: '02', title: 'الدقة',    desc: 'مكونات مختارة بعناية لضمان كمال النكهة.'   },
  { num: '03', title: 'الحِرفية', desc: 'فن الطهي البغدادي يتجسد في كل لمسة.'        },
  { num: '04', title: 'الكمال',   desc: 'لمسة أخيرة تليق بضيوف كهرمانة المميزين.'  },
]

export default function PhilosophyCards() {
  const cardRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            ;(entry.target as HTMLElement).style.setProperty('--visible', '1')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15 },
    )

    for (const el of cardRefs.current) {
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section dir="rtl" aria-label="فلسفة كهرمانة" className="py-24 px-6 sm:px-16 bg-brand-black">
      <div className="philosophy-track max-w-7xl mx-auto">
        {CARDS.map((card, i) => (
          <article
            key={card.num}
            ref={(el) => { cardRefs.current[i] = el }}
            className="philosophy-card"
            style={{ '--delay': `${i * 120}ms` } as CardStyle}
          >
            <span className="num">{card.num}</span>
            <h3 className="title">{card.title}</h3>
            <p className="desc">{card.desc}</p>
            <span className="tag">كهرمانة بغداد</span>
          </article>
        ))}
      </div>
    </section>
  )
}
