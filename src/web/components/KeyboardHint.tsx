import { Command } from 'lucide-react'
import { formatShortcut } from '../utils/keyboard'
import styles from './KeyboardHint.module.css'

interface KeyboardHintProps {
  onClick: () => void
}

export default function KeyboardHint({ onClick }: KeyboardHintProps) {
  return (
    <button
      className={styles.hint}
      onClick={onClick}
      title={`Keyboard shortcuts (${formatShortcut('Cmd+K')})`}
    >
      <Command size={12} />
      <span className={styles.key}>K</span>
    </button>
  )
}
