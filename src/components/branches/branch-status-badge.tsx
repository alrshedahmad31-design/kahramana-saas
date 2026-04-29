'use client'

interface Props {
  status: 'active' | 'planned'
  isAr?: boolean
  label: string
}

export default function BranchStatusBadge({ status, isAr, label }: Props) {
  if (status === 'active') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-success/10 border border-brand-success/20">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-success"></span>
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider text-brand-success ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/20">
      <span className={`text-[10px] font-bold uppercase tracking-wider text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {label}
      </span>
    </div>
  )
}
