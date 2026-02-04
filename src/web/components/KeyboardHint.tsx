import { Command } from 'lucide-react'
import { formatShortcut } from '../utils/keyboard'

interface KeyboardHintProps {
  onClick: () => void
}

export default function KeyboardHint({ onClick }: KeyboardHintProps) {
  return (
    <button
      className="keyboard-hint"
      onClick={onClick}
      title={`Keyboard shortcuts (${formatShortcut('Cmd+K')})`}
    >
      <Command size={12} />
      <span className="keyboard-hint-key">K</span>
    </button>
  )
}
