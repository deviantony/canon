import { useEffect, useRef } from 'react'
import { X, Command } from 'lucide-react'
import { formatKey } from '../utils/keyboard'
import styles from './KeyboardShortcutsModal.module.css'

interface ShortcutItem {
  keys: string[]
  label: string
  available?: boolean
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutItem[]
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
  canShowDiff?: boolean
  hasChanges?: boolean
  hasAnnotations?: boolean
  hasSelectedFile?: boolean
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
  canShowDiff = false,
  hasChanges = false,
  hasAnnotations = false,
  hasSelectedFile = false,
}: KeyboardShortcutsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Navigation',
      shortcuts: [
        { keys: ['Ctrl', 'Cmd', 'S'], label: 'Toggle sidebar', available: true },
        { keys: ['Ctrl', 'Cmd', 'Z'], label: 'Toggle changed/all files', available: hasChanges },
        { keys: ['Ctrl', 'Cmd', 'X'], label: 'Toggle diff/source view', available: canShowDiff },
      ],
    },
    {
      title: 'Annotations',
      shortcuts: [
        { keys: ['Ctrl', 'Cmd', 'C'], label: 'Add file comment', available: hasSelectedFile },
        { keys: ['Escape'], label: 'Clear selection / close panel', available: true },
      ],
    },
    {
      title: 'Review',
      shortcuts: [
        { keys: ['Ctrl', 'Cmd', 'Enter'], label: 'Submit review', available: hasAnnotations },
        { keys: ['Ctrl', 'Cmd', 'Backspace'], label: 'Cancel review', available: true },
      ],
    },
  ]

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.title}>
            <Command size={14} />
            <span>Keyboard Shortcuts</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {shortcutGroups.map((group) => (
            <div key={group.title} className={styles.group}>
              <h3 className={styles.groupTitle}>{group.title}</h3>
              <div className={styles.list}>
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className={`${styles.row} ${shortcut.available === false ? styles.unavailable : ''}`}
                  >
                    <span className={styles.label}>{shortcut.label}</span>
                    <div className={styles.keys}>
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd key={keyIdx} className={styles.key}>
                          {formatKey(key)}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.hint}>
            Press <kbd>esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}
