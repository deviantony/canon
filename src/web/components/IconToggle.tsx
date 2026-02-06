import type { ReactNode } from 'react'
import styles from './IconToggle.module.css'

interface ToggleOption<T extends string> {
  value: T
  icon: ReactNode
  title: string
  disabled?: boolean
  badge?: number
}

interface IconToggleProps<T extends string> {
  options: readonly [ToggleOption<T>, ToggleOption<T>]
  value: T
  onChange: (value: T) => void
  variant?: 'default' | 'compact'
}

export default function IconToggle<T extends string>({
  options,
  value,
  onChange,
  variant = 'default',
}: IconToggleProps<T>) {
  const containerClass =
    variant === 'compact' ? `${styles.iconToggle} ${styles.compact}` : styles.iconToggle

  return (
    <div className={containerClass}>
      {options.map((option) => {
        const isActive = value === option.value
        const showBadge = option.badge !== undefined && option.badge > 0 && isActive
        return (
          <button
            type="button"
            key={option.value}
            className={`${styles.btn} ${isActive ? styles.active : ''}`}
            onClick={() => onChange(option.value)}
            title={option.title}
            disabled={option.disabled}
          >
            {option.icon}
            {showBadge && <span className={styles.badge}>{option.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
