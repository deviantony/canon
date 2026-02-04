import { ReactNode } from 'react'

interface ToggleOption<T extends string> {
  value: T
  icon: ReactNode
  title: string
  disabled?: boolean
  badge?: number
}

interface IconToggleProps<T extends string> {
  options: [ToggleOption<T>, ToggleOption<T>]
  value: T
  onChange: (value: T) => void
}

export default function IconToggle<T extends string>({
  options,
  value,
  onChange,
}: IconToggleProps<T>) {
  return (
    <div className="icon-toggle">
      {options.map((option) => {
        const showBadge = option.badge !== undefined && option.badge > 0 && value === option.value
        return (
          <button
            key={option.value}
            className={`icon-toggle-btn ${value === option.value ? 'active' : ''}`}
            onClick={() => onChange(option.value)}
            title={option.title}
            disabled={option.disabled}
          >
            {option.icon}
            {showBadge && <span className="icon-toggle-badge">{option.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
