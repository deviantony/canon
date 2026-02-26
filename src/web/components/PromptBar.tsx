import { useCallback, useRef, useState } from 'react'
import { useSession } from '../context/SessionContext'
import styles from './PromptBar.module.css'

export default function PromptBar() {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sessionInfo, startSession, sendPrompt } = useSession()

  const isDisabled = sessionInfo?.state === 'starting' || sessionInfo?.state === 'processing'
  const hasSession = sessionInfo?.sessionId != null

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isDisabled) return

    if (hasSession) {
      sendPrompt(trimmed)
    } else {
      startSession(trimmed)
    }
    setText('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, isDisabled, hasSession, sendPrompt, startSession])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  const placeholder = hasSession ? 'Type a message...' : 'Start a session with a prompt...'

  return (
    <div className={styles.promptBar}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isDisabled}
        rows={1}
      />
    </div>
  )
}
