export const FILS_PER_BHD = 1000

export function bhdToFils(amount: number): number {
  return Math.round(amount * FILS_PER_BHD)
}

export function filsToBhd(amountFils: number): number {
  return amountFils / FILS_PER_BHD
}

export function formatPrice(amount: number, locale: string): string {
  const normalizedLocale = locale === 'ar' ? 'ar-BH' : 'en-BH'

  return new Intl.NumberFormat(normalizedLocale, {
    style: 'currency',
    currency: 'BHD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount)
}

export function formatPriceFils(amountFils: number, locale: string): string {
  return formatPrice(filsToBhd(amountFils), locale)
}
