/**
 * Keyboard shortcut display utilities
 * Provides consistent cross-platform formatting for keyboard shortcuts
 */

// Detect Mac platform once at module load
export const isMac =
  typeof navigator !== 'undefined' &&
  navigator.platform.toUpperCase().indexOf('MAC') >= 0

/**
 * Format a single key for display based on platform
 * e.g., 'Cmd' → '⌘' on Mac, 'Ctrl' on Windows/Linux
 */
export function formatKey(key: string): string {
  if (isMac) {
    return key
      .replace('Ctrl', '⌃')
      .replace('Cmd', '⌘')
      .replace('Alt', '⌥')
      .replace('Shift', '⇧')
      .replace('Enter', '↵')
      .replace('Backspace', '⌫')
      .replace('Escape', 'esc')
  }
  return key
    .replace('Cmd', 'Ctrl')
    .replace('Enter', '↵')
    .replace('Backspace', '⌫')
    .replace('Escape', 'Esc')
}

/**
 * Format a full shortcut string for display
 * e.g., 'Ctrl+Cmd+S' → '⌃⌘S' on Mac, 'Ctrl+Ctrl+S' → 'Ctrl+Ctrl+S' on Windows
 */
export function formatShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map((key) => formatKey(key.trim()))
    .join(isMac ? '' : '+')
}

/**
 * Get the modifier key for the current platform
 * Returns '⌘' on Mac, 'Ctrl' on Windows/Linux
 */
export function getModifierKey(): string {
  return isMac ? '⌘' : 'Ctrl'
}
