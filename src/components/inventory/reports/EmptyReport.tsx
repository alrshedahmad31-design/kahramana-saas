interface Props {
  title: string
  description: string
  cta?: { label: string; href: string }
}

export default function EmptyReport({ title, description, cta }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-brand-surface-2 flex items-center justify-center text-2xl">
        📊
      </div>
      <div>
        <p className="font-cairo text-lg font-black text-brand-text">{title}</p>
        <p className="font-satoshi text-sm text-brand-muted mt-1 max-w-sm">{description}</p>
      </div>
      {cta && (
        <a
          href={cta.href}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
        >
          {cta.label}
        </a>
      )}
    </div>
  )
}
