# Canon Design Guide

A minimal reference for Canon's design system.

## Philosophy

**Warm minimalism** — Dark interface with gold accents. Editorial aesthetic inspired by premium publishing tools. Subtle animations that feel responsive without being distracting.

## Colors

### Palette

| Token | Value | Use |
|-------|-------|-----|
| `--accent-gold` | `#d4a574` | Primary accent, interactive elements |
| `--accent-gold-bright` | `#e8c49a` | Hover states, highlights |
| `--accent-gold-muted` | `#9c7a58` | Borders, subtle accents |
| `--bg-void` | `#0c0c0c` | Page background |
| `--bg-surface` | `#111111` | Cards, panels |
| `--bg-elevated` | `#1a1a1a` | Raised elements |

### Status Colors

| Token | Use |
|-------|-----|
| `--status-success` | Added files, success states |
| `--status-warning` | Modified files |
| `--status-error` | Deleted files, destructive actions |
| `--status-info` | Renamed files, informational |

## Typography

| Token | Font | Use |
|-------|------|-----|
| `--font-display` | Geist | UI text, headings |
| `--font-mono` | JetBrains Mono | Code, badges, technical labels |

### Text Hierarchy

| Token | Use |
|-------|-----|
| `--text-primary` | Main content |
| `--text-secondary` | Supporting text |
| `--text-tertiary` | Labels, hints |
| `--text-muted` | Disabled, placeholder |

## Spacing

Base unit: **4px**

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |

## Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-xs` | 2px | Inline `kbd` elements |
| `--radius-btn` | 3px | Small buttons, keyboard hints |
| `--radius-sm` | 4px | Badges, scrollbar thumbs |
| `--radius-md` | 6px | Compact toggles |
| `--radius-lg` | 8px | Cards, input bars, annotation widgets |
| `--radius-pill` | 99px | Pill-shaped count badges |

## Components

### Cards

Annotation cards use a consistent pattern:
- Gold gradient background (`--gradient-card`)
- 1px gold border (`--accent-gold-muted`)
- `--radius-lg` border radius
- Hover: brighter border, enhanced gradient

### Buttons

**Icon buttons** (`baseStyles.actionIcon`):
- 26x26px, transparent background
- Hover: subtle background, border appears
- Delete variant (`actionIconDelete`): red on hover

**Text buttons** (`baseStyles.textBtn`):
- Monospace, uppercase, 9px
- Border with subtle background on hover
- Save variant (`textBtnSave`): gold accent color
- Delete variant (`textBtnDelete`): red on hover

**Standard buttons** (`baseStyles.btn`):
- 13px display font, rounded
- Variants: `btnSubmit` (gold), `btnCancel` (outline), `btnSecondary` (outline, red hover)

### Badges

**Line badges**: Gold border pill showing line numbers
**Status badges**: Color-coded file status (M, A, D, R)
**Count badges**: Pill showing annotation counts

## Animation

| Token | Duration | Use |
|-------|----------|-----|
| `--duration-fast` | 0.15s | Micro-interactions |
| `--duration-normal` | 0.25s | Standard transitions |
| `--duration-slow` | 0.4s | Entrance animations |

### Key Animations

| Name | Use |
|------|-----|
| `fadeSlideIn` | Card/element entrance |
| `fadeIn` | Overlay backgrounds |
| `accentPulse` | Highlight attention |
| `slideUp` | Modal entrance |

## File Structure

```
src/web/
├── styles/
│   ├── globals.css         # Tokens, reset, scrollbar, animations, CodeMirror overrides, inline annotations
│   └── base.module.css     # Shared patterns: actionIcon, textBtn, lineBadge, btn, card utilities
├── App.tsx
├── App.module.css          # App layout (app, main, contentArea, editorPanel)
└── components/
    ├── Component.tsx
    └── Component.module.css  # Co-located component styles
```

## CSS Naming Conventions

The codebase uses two naming conventions, each tied to a different styling system:

| System | Convention | Reason | Files |
|--------|------------|--------|-------|
| CSS Modules | camelCase | Class names become JS object keys (`styles.cardHeader`) | `*.module.css` |
| Global stylesheet | kebab-case | Classes set via string literals in imperative DOM code | `globals.css` |

**Why the difference?** Inline annotation widgets and gutter interactions are built with direct DOM manipulation (CodeMirror widgets, `document.createElement`), not React components. These set `element.className = 'inline-annotation-wrapper'` as plain strings — they cannot import CSS Modules. The kebab-case classes in `globals.css` exist exclusively for this imperative code in `inlineAnnotations.ts` and `gutterInteraction.ts`.

### CSS Modules

- Use camelCase for class names: `.cardHeader`, `.lineBadge`
- Import shared patterns from `base.module.css`:
  ```tsx
  import baseStyles from '../styles/base.module.css'
  <button className={baseStyles.actionIcon}>
  ```
- Available in `base.module.css`:
  - `actionIcon`, `actionIconDelete` — Icon buttons (26x26px)
  - `textBtn`, `textBtnSave`, `textBtnDelete` — Compact text buttons
  - `lineBadge`, `lineBadgeClickable` — Line number badges
  - `btn`, `btnSubmit`, `btnCancel`, `btnSecondary`, `btnReviewAll` — Standard buttons
  - `cardText`, `cardHeader`, `cardActions`, `cardEditFooter`, `hint` — Card utilities
- Keep component-specific styles (states, contextual selectors) in the component module
- Global styles only for: tokens, reset, scrollbar, inline annotations (imperative DOM), CodeMirror overrides

### Keyframe Animations in CSS Modules

**CSS Modules cannot reference global keyframes.** Animation names are scoped automatically.

If a component uses `animation: fadeSlideIn`, it must define the keyframe locally:
```css
/* Component.module.css */
.card {
  animation: fadeSlideIn var(--duration-slow) var(--ease-smooth) both;
}

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

The global `@keyframes fadeSlideIn` in `globals.css` is only for:
- Inline annotation widgets (created via imperative DOM)
- Third-party library overrides (CodeMirror)

This duplication is intentional and required by CSS Modules.
