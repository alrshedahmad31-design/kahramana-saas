// next-intl middleware (localePrefix: 'as-needed') rewrites '/' to
// app/[locale]/page.tsx with locale='ar' before this component renders.
// In production this file is a dead route — the middleware always intercepts first.
// Returning notFound() prevents a redirect loop if middleware is somehow bypassed.
import { notFound } from 'next/navigation'

export default function RootPage() {
  notFound()
}
