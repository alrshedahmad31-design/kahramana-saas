import type { ReactNode, SVGProps } from 'react'

export type LuxuryIconName =
  | 'branch'
  | 'check'
  | 'dining'
  | 'note'
  | 'orderNumber'
  | 'phone'
  | 'receipt'
  | 'total'
  | 'user'
  | 'warning'

type LuxuryIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  name: LuxuryIconName
  size?: number
  title?: string
}

const ICON_PATHS: Record<LuxuryIconName, ReactNode> = {
  branch: (
    <>
      <path d="M4.5 10.5h15" />
      <path d="M6 10.5v8h12v-8" />
      <path d="M8 18.5v-4h3v4" />
      <path d="M7 6h10l2.5 4.5h-15L7 6Z" />
    </>
  ),
  check: <path d="m5 12.5 4.25 4.25L19 7" />,
  dining: (
    <>
      <path d="M7 4v16" />
      <path d="M4.75 4v5.25a2.25 2.25 0 0 0 4.5 0V4" />
      <path d="M16.75 4.5c1.8 1.2 2.75 3.15 2.75 5.35 0 2.4-1.15 4.35-2.75 5.25V20" />
      <path d="M16.75 4.5V20" />
    </>
  ),
  note: (
    <>
      <path d="M6.5 4.5h8.25L18.5 8.25V19.5h-12v-15Z" />
      <path d="M14.5 4.75V8.5h3.75" />
      <path d="M9 12h6" />
      <path d="M9 15h4" />
    </>
  ),
  orderNumber: (
    <>
      <path d="M8 4.5 6.5 19.5" />
      <path d="M15.5 4.5 14 19.5" />
      <path d="M4.5 9h15" />
      <path d="M3.75 15h15" />
    </>
  ),
  phone: (
    <path d="M7.5 4.5h3l1.5 4-2 1.25a10.5 10.5 0 0 0 4.25 4.25L15.5 12l4 1.5v3a2 2 0 0 1-2.15 2 13.5 13.5 0 0 1-11.85-11.85 2 2 0 0 1 2-2.15Z" />
  ),
  receipt: (
    <>
      <path d="M7 4.5h10v15l-2-1.25-2 1.25-2-1.25-2 1.25-2-1.25v-15Z" />
      <path d="M9.5 8h5" />
      <path d="M9.5 11.5h5" />
      <path d="M9.5 15h3" />
    </>
  ),
  total: (
    <>
      <path d="M6 7.5h12" />
      <path d="M6 12h12" />
      <path d="M6 16.5h12" />
      <path d="M9 5v14" />
    </>
  ),
  user: (
    <>
      <path d="M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4.5 20 18.5H4L12 4.5Z" />
      <path d="M12 9.25v4" />
      <path d="M12 16.5h.01" />
    </>
  ),
}

export default function LuxuryIcon({
  name,
  size = 20,
  title,
  className,
  ...props
}: LuxuryIconProps) {
  const accessibilityProps = title
    ? { role: 'img', 'aria-label': title }
    : { 'aria-hidden': true }

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...accessibilityProps}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {ICON_PATHS[name]}
    </svg>
  )
}
