import styles from './CountBadge.module.css'

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
  const variantClass = variant === 'header' ? styles.header : styles.filter
  const activeClass = active && variant === 'filter' ? styles.filterActive : ''

  return (
    <span className={`${variantClass} ${activeClass}`}>
      {count}
    </span>
  )
}
