import { Command } from 'lucide-react'

interface KeyboardHintProps {
  onClick: () => void
}

export default function KeyboardHint({ onClick }: KeyboardHintProps) {
  return (
    <button
      className="keyboard-hint"
      onClick={onClick}
      title="Keyboard shortcuts (⌘K)"
    >
      <Command size={12} />
      <span className="keyboard-hint-key">K</span>
    </button>
  )
}
