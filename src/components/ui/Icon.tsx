import { type SVGProps } from 'react'

export type IconName =
  | 'breakfast'
  | 'appetizers'
  | 'grills'
  | 'sandwiches'
  | 'desserts'
  | 'drinks'
  | 'check'
  | 'x'
  | 'warning'
  | 'star'
  | 'location'
  | 'phone'
  | 'car'
  | 'bike'
  | 'clock'
  | 'bell'
  | 'user'
  | 'home'
  | 'chart'
  | 'search'
  | 'calendar'
  | 'wallet'
  | 'receipt'
  | 'fire'
  | 'chef'
  | 'driver'
  | 'package'
  | 'settings'
  | 'trash'
  | 'edit'
  | 'plus'
  | 'refresh'
  | 'store'
  | 'dish'
  | 'shield'
  | 'key'
  | 'globe'
  | 'trending-up'
  | 'trending-down'
  | 'message'
  | 'trophy'
  | 'box'
  | 'question'
  | 'arrow-right'
  | 'arrow-left'
  | 'info'
  | 'sparkle'
  | 'sos'
  | 'note'
  | 'laptop'
  | 'users'
  | 'pizza'
  | 'app'
  | 'email'
  | 'monitor'
  | 'bank'
  | 'map'
  | 'sleep'
  | 'alphabet'
  | 'eye'
  | 'cash'
  | 'moon'
  | 'pin'
  | 'run'
  | 'alert-dot'

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 20, className, ...props }: IconProps) {
  const labelled = Boolean(props['aria-label'])

  return (
    <svg
      width={size}
      height={size}
      className={className}
      aria-hidden={labelled ? undefined : true}
      role={labelled ? 'img' : undefined}
      {...props}
    >
      <use href={`/icons/sprite.svg#${name}`} />
    </svg>
  )
}
