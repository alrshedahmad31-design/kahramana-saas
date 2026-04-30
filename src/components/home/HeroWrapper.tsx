'use client'

import dynamic from 'next/dynamic'

const CinematicHero = dynamic(
  () => import('@/components/home/CinematicHero'),
  {
    ssr: false,
    loading: () => <div className="h-[100dvh] w-full bg-brand-black" />,
  }
)

export default function HeroWrapper() {
  return <CinematicHero />
}
