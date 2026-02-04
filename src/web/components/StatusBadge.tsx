import type { ChangedFile } from '../../shared/types'

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

  return (
    <span className={`status-badge ${status}`} title={status}>
      {labels[status] || '?'}
    </span>
  )
}
