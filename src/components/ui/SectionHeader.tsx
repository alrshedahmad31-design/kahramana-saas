interface SectionHeaderProps {
  title: string
  subtitle?: string
  className?: string
  /** Override heading level — defaults to h2. Pass 1 on the page's main hero section. */
  as?: 'h1' | 'h2' | 'h3'
  /** Deprecated: font direction now follows the nearest dir attribute. */
  isRTL?: boolean
}

export default function SectionHeader({
  title,
  subtitle,
  className = '',
  as: Heading = 'h2',
}: SectionHeaderProps) {
  return (
    <div
      className={`section-header ${className}`}
    >
      {subtitle && (
        <span className="section-subtitle">
          {subtitle}
        </span>
      )}
      <Heading className="section-title section-title-localized">
        {title}
      </Heading>
    </div>
  )
}
