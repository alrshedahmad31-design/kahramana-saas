export const FILS_PER_BHD = 1000

export function bhdToFils(amount: number): number {
  return Math.round(amount * FILS_PER_BHD)
}

export function filsToBhd(amountFils: number): number {
  return amountFils / FILS_PER_BHD
}

export function formatPrice(amount: number, locale: string): string {
  const isAr = locale === 'ar'
  const normalizedLocale = isAr ? 'ar-BH' : 'en-BH'
  const symbol = isAr ? 'د.ب' : 'BD'

  const formattedNumber = new Intl.NumberFormat(normalizedLocale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount)

  return isAr ? `${formattedNumber} ${symbol}` : `${formattedNumber} ${symbol}`
}

export function formatPriceFils(amountFils: number, locale: string): string {
  return formatPrice(filsToBhd(amountFils), locale)
}

