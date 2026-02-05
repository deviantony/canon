import type { ChangedFile } from '../../shared/types'
import styles from './StatusBadge.module.css'

interface StatusBadgeProps {
  status?: ChangedFile['status']
}

const labels: Record<string, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return null

  const statusClass = styles[status as keyof typeof styles] || styles.badge

  return (
    <span className={statusClass} title={status}>
      {labels[status] || '?'}
    </span>
  )
}
