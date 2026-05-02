'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'
import type { NormalizedMenuItem } from '@/lib/menu'
import { resolveMenuItemPrice } from '@/lib/menu'

interface ItemSelectionContextType {
  item: NormalizedMenuItem
  selectedSize: string | undefined
  selectedVariant: string | undefined
  quantity: number
  computedPrice: number
  lineTotal: number
  setSelectedSize: (size: string | undefined) => void
  setSelectedVariant: (variant: string | undefined) => void
  setQuantity: (quantity: number | ((prev: number) => number)) => void
}

export const ItemSelectionContext = createContext<ItemSelectionContextType | undefined>(undefined)

export function ItemSelectionProvider({
  children,
  item,
}: {
  children: React.ReactNode
  item: NormalizedMenuItem
}) {
  const sizeKeys = useMemo(() => (item.sizes ? Object.keys(item.sizes) : []), [item.sizes])

  const [selectedSize, setSelectedSize] = useState<string | undefined>(sizeKeys[0])
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(
    item.variants?.[0]?.label.en,
  )
  const [quantity, setQuantity] = useState(1)

  const computedPrice = useMemo(
    () =>
      resolveMenuItemPrice(item, {
        size: selectedSize,
        variant: selectedVariant,
      }),
    [item, selectedSize, selectedVariant],
  )

  const lineTotal = useMemo(() => computedPrice * quantity, [computedPrice, quantity])

  const value = useMemo(
    () => ({
      item,
      selectedSize,
      selectedVariant,
      quantity,
      computedPrice,
      lineTotal,
      setSelectedSize,
      setSelectedVariant,
      setQuantity,
    }),
    [item, selectedSize, selectedVariant, quantity, computedPrice, lineTotal],
  )

  return (
    <ItemSelectionContext.Provider value={value}>
      {children}
    </ItemSelectionContext.Provider>
  )
}

export function useItemSelection() {
  const context = useContext(ItemSelectionContext)
  if (context === undefined) {
    throw new Error('useItemSelection must be used within an ItemSelectionProvider')
  }
  return context
}
