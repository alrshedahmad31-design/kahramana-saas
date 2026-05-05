export function formatPrice(amount: number, locale: string): string {
  const normalizedLocale = locale === 'ar' ? 'ar-BH' : 'en-BH'

  return new Intl.NumberFormat(normalizedLocale, {
    style: 'currency',
    currency: 'BHD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount)
}
