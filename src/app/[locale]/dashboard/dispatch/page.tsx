import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function DispatchRedirectPage({ params }: Props) {
  const { locale } = await params
  redirect(locale === 'en' ? '/en/dashboard/delivery' : '/dashboard/delivery')
}
