type CateringIconName =
  | 'dining'
  | 'briefcase'
  | 'home'
  | 'spark'
  | 'request'
  | 'review'
  | 'confirm'
  | 'prepare'
  | 'message'

interface CateringIconProps {
  name: CateringIconName
  className?: string
}

export default function CateringIcon({ name, className = 'h-5 w-5' }: CateringIconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  if (name === 'briefcase') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
        <path d="M4.5 8.5h15v9A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
        <path d="M4.5 12.5h15" />
        <path d="M10 12.5v1h4v-1" />
      </svg>
    )
  }

  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6.5 10.5V19h11v-8.5" />
        <path d="M9.5 19v-5h5v5" />
      </svg>
    )
  }

  if (name === 'spark') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M12 3.5 14.2 9l5.3 2.2-5.3 2.2L12 19l-2.2-5.6-5.3-2.2L9.8 9 12 3.5Z" />
        <path d="m18.5 4.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
      </svg>
    )
  }

  if (name === 'request') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v12A1.5 1.5 0 0 1 17 19.5H7A1.5 1.5 0 0 1 5.5 18V6A1.5 1.5 0 0 1 7 4.5Z" />
        <path d="M8.5 8.5h7" />
        <path d="M8.5 12h7" />
        <path d="M8.5 15.5h4" />
      </svg>
    )
  }

  if (name === 'review') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M10.5 18.5a8 8 0 1 1 5.7-2.35L20 20" />
        <path d="m8.5 11.5 2 2 4.5-5" />
      </svg>
    )
  }

  if (name === 'confirm') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M5 12.5 9.5 17 19 7" />
        <path d="M4.5 5.5h15v13h-15z" />
      </svg>
    )
  }

  if (name === 'prepare') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M6 10.5h12" />
        <path d="M7.5 10.5 8.5 20h7l1-9.5" />
        <path d="M9 7.5c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5" />
        <path d="M10 14h4" />
      </svg>
    )
  }

  if (name === 'message') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M5.5 6.5h13v8.5a2 2 0 0 1-2 2H10l-4.5 3v-13.5Z" />
        <path d="M8.5 10h7" />
        <path d="M8.5 13h4.5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M7 3.5v17" />
      <path d="M17 3.5v17" />
      <path d="M7 7.5h10" />
      <path d="M7 12h10" />
      <path d="M7 16.5h10" />
    </svg>
  )
}
