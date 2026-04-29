import Image from 'next/image'

interface MenuItemImageProps {
  src: string
  alt: string
  priority?: boolean
  sizes: string
  className?: string
}

export default function MenuItemImage({
  src,
  alt,
  priority = false,
  sizes,
  className = '',
}: MenuItemImageProps) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-brand-surface-2">
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className={`object-cover transition-transform duration-500 ${className}`}
        sizes={sizes}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-brand-black/70 via-brand-black/10 to-transparent"
      />
    </div>
  )
}
