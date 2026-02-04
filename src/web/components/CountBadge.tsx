interface CountBadgeProps {
  count: number
  /** 'filter' for sidebar filter buttons, 'header' for main header buttons */
  variant?: 'filter' | 'header'
  /** Whether the parent button is in active state */
  active?: boolean
}

/**
 * Unified count badge component used across the app
 * - Filter variant: smaller, used in sidebar filter toggle
 * - Header variant: standard size, used in header action buttons
 */
export default function CountBadge({ count, variant = 'filter', active = false }: CountBadgeProps) {
  const className = `count-badge count-badge--${variant}${active ? ' count-badge--active' : ''}`

  return (
    <span className={className}>
      {count}
    </span>
  )
}
