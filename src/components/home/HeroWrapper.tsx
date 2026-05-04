import CinematicHero from '@/components/home/CinematicHero'

// Preload declared here (sync Server Component) so React 19 hoists it to <head>
// before CinematicHero's async work resolves. If declared inside the async
// CinematicHero, the hint arrives late in the stream and misses the preload scanner.
export default function HeroWrapper() {
  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/assets/hero/hero-poster.webp"
        fetchPriority="high"
      />
      <CinematicHero />
    </>
  )
}
