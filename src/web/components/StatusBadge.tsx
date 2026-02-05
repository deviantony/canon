import type { ChangedFile } from '../../shared/types'
import styles from './StatusBadge.module.css'

interface StatusBadgeProps {
  status?: ChangedFile['status']
}

const labels: Record<ChangedFile['status'], string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
}

const statusStyles: Record<ChangedFile['status'], string> = {
  modified: styles.modified,
  added: styles.added,
  deleted: styles.deleted,
  renamed: styles.renamed,
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return null

  const statusClass = statusStyles[status] || styles.badge

  return (
    <span className={statusClass} title={status}>
      {labels[status] || '?'}
    </span>
  )
}
