import CinematicHero from '@/components/home/CinematicHero'

// No dynamic() wrapper — direct import keeps the Suspense boundary out of the
// critical path so the SSR-rendered hero image is never replaced by a fallback
// during hydration. This is the primary LCP fix.
export default function HeroWrapper() {
  return <CinematicHero />
}
