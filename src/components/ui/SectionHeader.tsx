interface SectionHeaderProps {
  title: string
  subtitle?: string
  className?: string
  /** Deprecated: font direction now follows the nearest dir attribute. */
  isRTL?: boolean
}

export default function SectionHeader({ 
  title, 
  subtitle, 
  className = '',
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
      <h2 className="section-title section-title-localized">
        {title}
      </h2>
    </div>
  )
}
