'use client'

import dynamic from 'next/dynamic'

// ssr: false is valid here because this is a Client Component.
// The dynamic import keeps GSAP (~30KB) out of the initial JS bundle;
// HeroAnimations loads lazily after hydration and is excluded from SSR.
const HeroAnimations = dynamic(() => import('./HeroAnimations'), { ssr: false })

export default function HeroAnimationsLoader() {
  return <HeroAnimations />
}
