'use client'

import dynamic from 'next/dynamic'
import { useCartStore } from '@/lib/cart'

const CartDrawer = dynamic(() => import('./CartDrawer'), { ssr: false })

export default function CartDrawerDynamic() {
  const isOpen = useCartStore((state) => state.isOpen)
  if (!isOpen) return null

  return <CartDrawer />
}
