import AddToCartButton from '@/components/cart/AddToCartButton'

interface StickyAddToCartProps {
  isRTL: boolean
}

export default function StickyAddToCart({ isRTL }: StickyAddToCartProps) {
  return (
    <div className="sticky bottom-0 z-30 -ms-4 -me-4 border-t border-brand-gold/10 bg-brand-black/90 ps-4 pe-4 pt-4 pb-4 backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <AddToCartButton isRTL={isRTL} />
    </div>
  )
}
