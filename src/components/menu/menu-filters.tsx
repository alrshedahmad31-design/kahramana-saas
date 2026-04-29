interface MenuFiltersProps {
  availableOnly: boolean
  onAvailableOnlyChange: (value: boolean) => void
  label: string
  isRTL: boolean
}

export default function MenuFilters({
  availableOnly,
  onAvailableOnlyChange,
  label,
  isRTL,
}: MenuFiltersProps) {
  return (
    <button
      type="button"
      aria-pressed={availableOnly}
      aria-label={label}
      onClick={() => onAvailableOnlyChange(!availableOnly)}
      className={`flex min-h-[52px] items-center justify-center gap-3 rounded-xl border ps-5 pe-5 text-sm font-bold transition-all duration-300 active:scale-95 ${
        isRTL ? 'font-almarai' : 'font-satoshi'
      } ${
        availableOnly
          ? 'border-brand-gold bg-brand-gold text-brand-black shadow-[0_4px_15px_rgba(200,146,42,0.25)]'
          : 'border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-gold hover:text-brand-text'
      }`}
    >
      <div
        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors duration-300 ${
          availableOnly ? 'border-brand-black bg-brand-black' : 'border-brand-muted'
        }`}
        aria-hidden="true"
      >
        {availableOnly && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      {label}
    </button>
  )
}
