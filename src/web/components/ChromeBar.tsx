import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitInfo } from '../../shared/types'
import styles from './ChromeBar.module.css'

export type PillarId = 'conv' | 'code'

interface PillarDef {
  id: PillarId
  label: string
}

const PILLARS: PillarDef[] = [
  { id: 'conv', label: 'Conversation' },
  { id: 'code', label: 'Code' },
]

interface ChromeBarProps {
  activePillar: PillarId
  onPillarChange: (id: PillarId) => void
  gitInfo: GitInfo | null
  version: string
}

// Sun SVG icon for the logo
function SunIcon() {
  return (
    <svg
      className={styles.logoSun}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      role="img"
      aria-label="Sun"
    >
      <title>Sun</title>
      <defs>
        <linearGradient id="sunGrad" x1="5" y1="16" x2="19" y2="6">
          <stop offset="0%" stopColor="#d4a574" />
          <stop offset="50%" stopColor="#c4786a" />
          <stop offset="100%" stopColor="#d4a574" />
        </linearGradient>
      </defs>
      <path
        d="M12 16 A6 6 0 0 1 6 16 A6 6 0 0 1 12 10 A6 6 0 0 1 18 16 Z"
        fill="url(#sunGrad)"
        opacity="0.9"
      />
      <line
        x1="4"
        y1="16"
        x2="20"
        y2="16"
        stroke="var(--accent-gold)"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <line x1="12" y1="8" x2="12" y2="5.5" stroke="var(--accent-gold)" strokeWidth="1.5" />
      <line x1="8" y1="9.5" x2="6.5" y2="8" stroke="var(--accent-gold)" strokeWidth="1.5" />
      <line x1="16" y1="9.5" x2="17.5" y2="8" stroke="var(--accent-gold)" strokeWidth="1.5" />
    </svg>
  )
}

export default function ChromeBar({
  activePillar,
  onPillarChange,
  gitInfo,
  version,
}: ChromeBarProps) {
  const [gitPopoverOpen, setGitPopoverOpen] = useState(false)
  const gitBranchRef = useRef<HTMLDivElement>(null)

  const branch = gitInfo?.branch ?? 'main'
  const ahead = gitInfo?.ahead ?? 0

  // Close git popover on click outside
  useEffect(() => {
    if (!gitPopoverOpen) return
    function handleClick(e: MouseEvent) {
      if (gitBranchRef.current && !gitBranchRef.current.contains(e.target as Node)) {
        setGitPopoverOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [gitPopoverOpen])

  const toggleGitPopover = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setGitPopoverOpen((prev) => !prev)
  }, [])

  return (
    <div className={styles.chrome}>
      <span className={styles.logo}>
        AUR
        <SunIcon />
        RE
      </span>
      <span className={styles.logoVersion}>v{version}</span>

      <div className={styles.pillarNav}>
        {PILLARS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.pillarBtn} ${activePillar === p.id ? styles.pillarBtnActive : ''}`}
            onClick={() => onPillarChange(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div ref={gitBranchRef} className={styles.gitBranchWrap}>
        <button
          type="button"
          className={`${styles.gitBranch} ${gitPopoverOpen ? styles.gitBranchOpen : ''}`}
          onClick={toggleGitPopover}
        >
          <span className={styles.gitBranchIcon}>&#9095;</span>
          <span>{branch}</span>
          {ahead > 0 && <span className={styles.gitAhead}>&#8593;{ahead}</span>}
        </button>

        <div className={`${styles.gitPopover} ${gitPopoverOpen ? styles.gitPopoverOpen : ''}`}>
          <div className={styles.gitPopHeader}>
            <span className={styles.gitPopBranch}>{branch}</span>
            {ahead > 0 && <span className={styles.gitPopStatus}>{ahead} ahead</span>}
          </div>
          <div className={styles.gitPopActions}>
            <button type="button" className={styles.gitPopAction}>
              <span className={styles.gitPopActionIcon}>&#9679;</span>
              Commit
              <span className={styles.gitPopActionDetail}>
                {gitInfo?.changedFiles?.length ?? 0} files
              </span>
            </button>
            <button type="button" className={styles.gitPopAction}>
              <span className={styles.gitPopActionIcon}>&#8593;</span>
              Push
              <span className={styles.gitPopActionDetail}>origin/{branch}</span>
            </button>
            <div className={styles.gitPopSep} />
            <button type="button" className={styles.gitPopAction}>
              <span className={styles.gitPopActionIcon}>&#8853;</span>
              Create Pull Request
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
