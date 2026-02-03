import { useEffect, RefObject } from 'react'

/**
 * Auto-resize a textarea to fit its content
 */
export function useAutoResizeTextarea(
  textareaRef: RefObject<HTMLTextAreaElement>,
  value: string,
  minHeight: number = 0
): void {
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.max(minHeight, textareaRef.current.scrollHeight) + 'px'
    }
  }, [value, minHeight])
}
