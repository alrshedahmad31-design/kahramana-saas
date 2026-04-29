import type { NormalizedMenuItem } from '@/lib/menu'

interface ItemPriceSelectorProps {
  item: NormalizedMenuItem
  price: number
  total?: number
  currency: string
  fromLabel: string
}

export default function ItemPriceSelector({
  item,
  price,
  total,
  currency,
  fromLabel,
}: ItemPriceSelectorProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-baseline gap-1 font-satoshi tabular-nums text-brand-gold">
        {item.hasMultiplePrices && !total && (
          <span className="text-xs font-bold text-brand-muted/60 uppercase tracking-wider">{fromLabel} </span>
        )}
        <span className="text-4xl font-black">{price.toFixed(3)}</span>
        <span className="text-sm font-bold text-brand-muted/80">{currency}</span>
      </div>
      
      {typeof total === 'number' && total !== price && (
        <div className="flex items-baseline gap-1 font-satoshi tabular-nums text-brand-text/40">
          <span className="text-sm font-medium line-through">{total.toFixed(3)}</span>
          <span className="text-[10px] font-bold uppercase">{currency}</span>
        </div>
      )}
    </div>
  )
}
