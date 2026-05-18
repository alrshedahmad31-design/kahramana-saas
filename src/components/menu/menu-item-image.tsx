'use client'

import Image from 'next/image'
import { useState } from 'react'

interface MenuItemImageProps {
  src: string
  alt: string
  priority?: boolean
  sizes: string
  className?: string
  /** Bottom-up dark gradient overlay. Used by the dish hero; cards typically omit it. */
  withOverlay?: boolean
}

export default function MenuItemImage({
  src,
  alt,
  priority = false,
  sizes,
  className = '',
  withOverlay = true,
}: MenuItemImageProps) {
  const [errored, setErrored] = useState(false)

  return (
    <div className="absolute inset-0 overflow-hidden bg-brand-surface-2">
      {errored ? (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 flex items-center justify-center bg-brand-black"
        >
          <Image
            src="/assets/brand/logo.webp"
            alt=""
            width={120}
            height={195}
            aria-hidden="true"
            className="h-1/2 w-auto opacity-25 mix-blend-screen"
          />
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className={`object-cover transition-transform duration-500 ${className}`}
          sizes={sizes}
          onError={() => setErrored(true)}
        />
      )}
      {withOverlay && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-brand-black/70 via-brand-black/10 to-transparent"
        />
      )}
    </div>
  )
}
