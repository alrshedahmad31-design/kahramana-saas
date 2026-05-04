'use client'

import dynamic from 'next/dynamic'

const FeatureArtifacts = dynamic(() => import('./FeatureArtifacts'), {
  ssr: false,
  loading: () => (
    <section
      aria-hidden="true"
      className="py-20 px-6 sm:px-16 max-w-7xl mx-auto min-h-[1558px] md:min-h-[610px]"
    />
  ),
})

export default function FeatureArtifactsWrapper() {
  return <FeatureArtifacts />
}
