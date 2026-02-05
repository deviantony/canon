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

## Components

### Cards

Annotation cards use a consistent pattern:
- Gold gradient background (`--gradient-card`)
- 1px gold border (`--accent-gold-muted`)
- 8px border radius
- Hover: brighter border, enhanced gradient

### Buttons

**Icon buttons** (`.action` in modules):
- 26x26px, transparent background
- Hover: subtle background, border appears
- Delete variant: red on hover

**Text buttons** (`.btn`, `.actionBtn`):
- Monospace, uppercase, 9px
- Border with subtle background on hover
- Save variant: gold accent color

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
│   └── globals.css      # Tokens, reset, scrollbar, animations, CodeMirror overrides, inline annotations
└── components/
    ├── Component.tsx
    └── Component.module.css  # Co-located styles
```

## CSS Modules Convention

- Use camelCase for class names: `.cardHeader`, `.actionBtn`
- Use `composes` for shared base styles
- Keep component-specific styles in the module
- Global styles only for: tokens, reset, animations, CodeMirror overrides
