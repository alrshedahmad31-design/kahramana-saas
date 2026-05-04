import { Link } from '@/i18n/navigation'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { ReactNode } from 'react'

interface CinematicButtonProps {
  href?: string
  onClick?: () => void
  children: ReactNode
  className?: string
  isRTL?: boolean
  variant?: 'primary' | 'secondary'
  showIcon?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

export default function CinematicButton({
  href,
  onClick,
  children,
  className = '',
  isRTL = false,
  variant = 'primary',
  showIcon = true,
  type = 'button',
  disabled = false
}: CinematicButtonProps) {
  const isPrimary = variant === 'primary'

  const content = (
    <>
      <span className="relative z-10 flex items-center gap-3">
        {children}
        {showIcon && (
          isRTL 
            ? <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-2" /> 
            : <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
        )}
      </span>
      <span
        className={`absolute inset-0 ${isPrimary ? 'bg-white/20' : 'bg-brand-gold/10'} translate-y-full group-hover:translate-y-0 transition-transform duration-500`} 
        aria-hidden="true"
      />
    </>
  )

  const baseClasses = `
    group relative overflow-hidden transition-all hover:scale-105 active:scale-95 inline-flex items-center justify-center
    ${isPrimary 
      ? 'bg-brand-gold text-brand-black shadow-[0_20px_50px_rgba(200,146,42,0.2)]' 
      : 'border border-white/10 text-brand-text backdrop-blur-md hover:bg-white/5'}
    ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
    ${className}
  `

  if (href) {
    if (href.startsWith('http')) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={baseClasses}>
          {content}
        </a>
      )
    }
    return (
      <Link
        href={href as Parameters<typeof Link>[0]['href']}
        className={baseClasses}
      >
        {content}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={baseClasses}>
      {content}
    </button>
  )
}
