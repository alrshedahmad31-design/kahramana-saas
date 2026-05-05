import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { BranchId } from '@/constants/contact'
import { bhdToFils, filsToBhd } from '@/lib/format'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  cartKey: string        // unique: itemId + size + variant
  itemId: string
  nameAr: string
  nameEn: string
  imageUrl?: string
  quantity: number
  priceFils?: number     // canonical price snapshot at add-to-cart time
  priceBhd?: number      // legacy persisted carts only
  selectedSize?: string
  selectedVariant?: string
  notes?: string         // per-item special instructions
}

// ── Size display labels (all possible size keys in menu.json) ─────────────────

export const SIZE_LABELS: Record<string, { ar: string; en: string }> = {
  S:          { ar: 'صغير',          en: 'Small'   },
  M:          { ar: 'وسط',           en: 'Medium'  },
  L:          { ar: 'كبير',          en: 'Large'   },
  XL:         { ar: 'إكسترا لارج',  en: 'XL'      },
  Glass:      { ar: 'كأس',           en: 'Glass'   },
  '0.5L':     { ar: '٠.٥ لتر',      en: '0.5 L'   },
  '1L':       { ar: '١ لتر',         en: '1 L'     },
  '1.5L':     { ar: '١.٥ لتر',      en: '1.5 L'   },
  '1KG':      { ar: '١ كغ',          en: '1 KG'    },
  'HALF KG':  { ar: '٠.٥ كغ',       en: '0.5 KG'  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildCartKey(
  itemId: string,
  selectedSize?: string,
  selectedVariant?: string,
): string {
  return [itemId, selectedSize ?? '', selectedVariant ?? ''].join('__')
}

export function selectTotalItems(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export function getCartItemUnitPriceFils(item: CartItem): number {
  return item.priceFils ?? bhdToFils(item.priceBhd ?? 0)
}

export function selectLineTotalFils(item: CartItem): number {
  return getCartItemUnitPriceFils(item) * item.quantity
}

export function selectCartTotalFils(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + selectLineTotalFils(item), 0)
}

export function selectSubtotal(items: CartItem[]): number {
  return filsToBhd(selectCartTotalFils(items))
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[]
  branchId: BranchId
  isOpen: boolean
}

interface CartActions {
  addItem: (item: Omit<CartItem, 'cartKey' | 'quantity'> & { quantity?: number }) => void
  removeItem: (cartKey: string) => void
  updateQuantity: (cartKey: string, quantity: number) => void
  updateItemNotes: (cartKey: string, notes: string) => void
  clearCart: () => void
  setBranch: (branchId: BranchId) => void
  openCart: () => void
  closeCart: () => void
}

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      // ── State
      items:    [],
      branchId: 'riffa',
      isOpen:   false,

      // ── Actions
      addItem: (newItem) => {
        const cartKey = buildCartKey(
          newItem.itemId,
          newItem.selectedSize,
          newItem.selectedVariant,
        )
        const { priceBhd, priceFils, quantity, ...itemFields } = newItem
        const unitPriceFils = priceFils ?? bhdToFils(priceBhd ?? 0)

        set((state) => {
          const existing = state.items.find((i) => i.cartKey === cartKey)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.cartKey === cartKey
                  ? { ...i, quantity: i.quantity + (quantity ?? 1) }
                  : i,
              ),
              isOpen: true,
            }
          }
          return {
            items: [
              ...state.items,
              {
                ...itemFields,
                cartKey,
                quantity: quantity ?? 1,
                priceFils: unitPriceFils,
              },
            ],
            isOpen: true,
          }
        })
      },

      removeItem: (cartKey) =>
        set((state) => ({
          items: state.items.filter((i) => i.cartKey !== cartKey),
        })),

      updateQuantity: (cartKey, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartKey)
          return
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.cartKey === cartKey ? { ...i, quantity } : i,
          ),
        }))
      },

      updateItemNotes: (cartKey, notes) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.cartKey === cartKey ? { ...i, notes: notes.trim() || undefined } : i,
          ),
        })),

      clearCart: () => set({ items: [] }),

      setBranch: (branchId) => set({ branchId }),

      openCart:  () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
    }),
    {
      name: 'kahramana-cart',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : {
          getItem:    () => null,
          setItem:    () => undefined,
          removeItem: () => undefined,
        },
      ),
      // Don't persist isOpen — drawer should start closed on page load
      partialize: (state) => ({ items: state.items, branchId: state.branchId }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== 'kahramana-cart' || event.storageArea !== window.localStorage) return
    void useCartStore.persist.rehydrate()
  })
}
