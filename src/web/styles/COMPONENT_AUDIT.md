# CSS Component Audit

This document maps CSS dependencies per component for the CSS Modules migration.

## Component Inventory

### High Priority (Complex, many shared patterns)

| Component | File | Primary Classes | Shared Patterns | Module Priority |
|-----------|------|-----------------|-----------------|-----------------|
| AnnotationCard | `AnnotationCard.tsx` | `annotation-card`, `annotation-card-*` | `.card`, `.action-icon`, `.text-btn`, `.line-badge` | **High** |
| FileAnnotationFooter | `FileAnnotationFooter.tsx` | `file-annotation-*` | `.card`, `.action-icon`, `.text-btn`, `.line-badge` | **High** |
| InlineAnnotation | `hooks/useEditorInteraction.ts` | `inline-annotation-*` | `.card`, `.action-icon`, `.text-btn`, `.line-badge` | **High** |

### Medium Priority (Self-contained, some shared patterns)

| Component | File | Primary Classes | Shared Patterns | Module Priority |
|-----------|------|-----------------|-----------------|-----------------|
| Header | `Header.tsx` | `header`, `header-left`, `header-actions`, `logo-wordmark`, `version-badge`, `sidebar-toggle` | `.btn` | Medium |
| Sidebar | `Sidebar.tsx` | `sidebar`, `sidebar-header`, `sidebar-content` | None | Medium |
| AnnotationSummaryPopover | `AnnotationSummaryPopover.tsx` | `summary-*` | `.card`, `.action-icon`, `.btn`, `.line-badge` | Medium |
| FileTree | `FileTree.tsx` | `file-tree`, `tree-node`, `file-icon`, `file-name`, `annotation-badge` | None | Medium |
| EditorHeader | `EditorHeader.tsx` | `editor-header`, `file-info`, `file-path`, `file-annotation-count` | None | Medium |

### Low Priority (Simple, few dependencies)

| Component | File | Primary Classes | Shared Patterns | Module Priority |
|-----------|------|-----------------|-----------------|-----------------|
| CompletionScreen | `CompletionScreen.tsx` | `completion-*`, `seal-*` | None | Low |
| KeyboardShortcutsModal | `KeyboardShortcutsModal.tsx` | `shortcuts-*`, `shortcut-*` | None | Low |
| CodeViewer | `CodeViewer.tsx` | `code-viewer`, `codemirror-container`, `code-content` | None | Low |
| DiffViewer | `DiffViewer.tsx` | `diff-viewer`, `diff-content` | None | Low |
| IconToggle | `IconToggle.tsx` | `icon-toggle`, `icon-toggle-btn`, `icon-toggle-badge` | None | Low |
| StatusBadge | `StatusBadge.tsx` | `status-badge` | None | Low |
| CountBadge | `CountBadge.tsx` | `count-badge`, `count-badge--*` | None | Low |
| KeyboardHint | `KeyboardHint.tsx` | `keyboard-hint`, `keyboard-hint-key` | None | Low |

### Layout Components (App-level)

| Component | File | Primary Classes |
|-----------|------|-----------------|
| App | `App.tsx` | `app`, `main`, `content-area`, `editor-panel` |

---

## CSS Class to Component Mapping

### Annotation System Classes

```
annotation-card              → AnnotationCard.tsx
annotation-card-header       → AnnotationCard.tsx
annotation-card-actions      → AnnotationCard.tsx
annotation-card-action       → AnnotationCard.tsx
annotation-card-text         → AnnotationCard.tsx
annotation-card-edit         → AnnotationCard.tsx
annotation-card-edit-footer  → AnnotationCard.tsx
annotation-action-btn        → AnnotationCard.tsx
annotation-line-badge        → AnnotationCard.tsx, AnnotationSummaryPopover.tsx

inline-annotation-wrapper    → useEditorInteraction.ts (hook creates DOM)
inline-annotation            → useEditorInteraction.ts
inline-annotation-header     → useEditorInteraction.ts
inline-annotation-badge      → useEditorInteraction.ts
inline-annotation-actions    → useEditorInteraction.ts
inline-annotation-action     → useEditorInteraction.ts, FileAnnotationFooter.tsx
inline-annotation-content    → useEditorInteraction.ts
inline-annotation-textarea   → useEditorInteraction.ts
inline-annotation-edit-actions → useEditorInteraction.ts
inline-annotation-hint       → useEditorInteraction.ts
inline-annotation-btn        → useEditorInteraction.ts

file-annotation-footer       → FileAnnotationFooter.tsx
file-annotation-input-bar    → FileAnnotationFooter.tsx
file-annotation-input-icon   → FileAnnotationFooter.tsx
file-annotation-placeholder  → FileAnnotationFooter.tsx
file-annotation-card         → FileAnnotationFooter.tsx
file-annotation-header       → FileAnnotationFooter.tsx
file-annotation-badge        → FileAnnotationFooter.tsx
file-annotation-text         → FileAnnotationFooter.tsx
file-annotation-actions      → FileAnnotationFooter.tsx
file-annotation-edit-card    → FileAnnotationFooter.tsx
file-annotation-edit-actions → FileAnnotationFooter.tsx
file-annotation-btn          → FileAnnotationFooter.tsx
```

### Header & Navigation Classes

```
header                       → Header.tsx
header-left                  → Header.tsx
header-actions               → Header.tsx
logo-wordmark                → Header.tsx
version-badge                → Header.tsx
sidebar-toggle               → Header.tsx
btn                          → Header.tsx, AnnotationSummaryPopover.tsx
```

### Sidebar & File Tree Classes

```
sidebar                      → Sidebar.tsx
sidebar-header               → Sidebar.tsx
sidebar-content              → Sidebar.tsx
sidebar-resize-handle        → Sidebar.tsx (CSS only, no className)

file-tree                    → FileTree.tsx
file-tree-loading            → FileTree.tsx
file-tree-error              → FileTree.tsx
file-tree-empty              → FileTree.tsx
tree-node                    → FileTree.tsx
file-icon                    → FileTree.tsx
file-name                    → FileTree.tsx
annotation-badge             → FileTree.tsx
status-badge                 → StatusBadge.tsx
```

### Editor Classes

```
editor-header                → EditorHeader.tsx
file-info                    → EditorHeader.tsx
file-path                    → EditorHeader.tsx
file-annotation-count        → EditorHeader.tsx

code-viewer                  → CodeViewer.tsx
code-content                 → CodeViewer.tsx
codemirror-container         → CodeViewer.tsx

diff-viewer                  → DiffViewer.tsx
diff-content                 → DiffViewer.tsx
```

### Modal & Popover Classes

```
summary-popover-overlay      → AnnotationSummaryPopover.tsx
summary-popover              → AnnotationSummaryPopover.tsx
summary-popover-header       → AnnotationSummaryPopover.tsx
summary-popover-title        → AnnotationSummaryPopover.tsx
summary-popover-close        → AnnotationSummaryPopover.tsx
summary-popover-content      → AnnotationSummaryPopover.tsx
summary-popover-footer       → AnnotationSummaryPopover.tsx
summary-file-group           → AnnotationSummaryPopover.tsx
summary-file-name            → AnnotationSummaryPopover.tsx
summary-annotation           → AnnotationSummaryPopover.tsx
summary-annotation-text      → AnnotationSummaryPopover.tsx
summary-annotation-actions   → AnnotationSummaryPopover.tsx
summary-annotation-action    → AnnotationSummaryPopover.tsx
summary-empty                → AnnotationSummaryPopover.tsx

shortcuts-modal-overlay      → KeyboardShortcutsModal.tsx
shortcuts-modal              → KeyboardShortcutsModal.tsx
shortcuts-modal-header       → KeyboardShortcutsModal.tsx
shortcuts-modal-title        → KeyboardShortcutsModal.tsx
shortcuts-modal-close        → KeyboardShortcutsModal.tsx
shortcuts-modal-content      → KeyboardShortcutsModal.tsx
shortcuts-modal-footer       → KeyboardShortcutsModal.tsx
shortcuts-group              → KeyboardShortcutsModal.tsx
shortcuts-group-title        → KeyboardShortcutsModal.tsx
shortcuts-list               → KeyboardShortcutsModal.tsx
shortcut-row                 → KeyboardShortcutsModal.tsx (CSS only)
shortcut-label               → KeyboardShortcutsModal.tsx
shortcut-keys                → KeyboardShortcutsModal.tsx
shortcut-key                 → KeyboardShortcutsModal.tsx
shortcuts-hint               → KeyboardShortcutsModal.tsx
```

### Completion Screen Classes

```
completion-screen            → CompletionScreen.tsx
completion-bg-texture        → CompletionScreen.tsx
completion-content           → CompletionScreen.tsx
completion-seal              → CompletionScreen.tsx
seal-ring                    → CompletionScreen.tsx
seal-ring-1/2/3              → CompletionScreen.tsx
seal-core                    → CompletionScreen.tsx
seal-icon                    → CompletionScreen.tsx
completion-text              → CompletionScreen.tsx
completion-label             → CompletionScreen.tsx
completion-title             → CompletionScreen.tsx
completion-message           → CompletionScreen.tsx
completion-footer            → CompletionScreen.tsx
completion-divider           → CompletionScreen.tsx
completion-instruction       → CompletionScreen.tsx
completion-highlight         → CompletionScreen.tsx
```

### Utility Components

```
icon-toggle                  → IconToggle.tsx
icon-toggle-btn              → IconToggle.tsx
icon-toggle-badge            → IconToggle.tsx

count-badge                  → CountBadge.tsx
count-badge--filter          → CountBadge.tsx
count-badge--header          → CountBadge.tsx
count-badge--active          → CountBadge.tsx

keyboard-hint                → KeyboardHint.tsx
keyboard-hint-key            → KeyboardHint.tsx
```

### CodeMirror Integration Classes (CSS only, no React className)

```
cm-selectedAnnotationLine    → globals.css (CodeMirror line decoration)
cm-lineNumbers               → globals.css (CodeMirror gutter styling)
cm-line-selecting            → globals.css (selection state)
line-selection-indicator     → useEditorInteraction.ts (floating indicator)
```

---

## Target Module Structure for Phase 4

**Co-located approach**: CSS modules live next to their components.

```
src/web/
├── styles/
│   ├── globals.css          # Reset, scrollbar, CodeMirror overrides (~400 lines)
│   ├── tokens.css           # All :root variables (~120 lines)
│   └── base.module.css      # .card, .action-icon, .text-btn, .line-badge (~200 lines)
├── components/
│   ├── Header.tsx
│   ├── Header.module.css           # ~80 lines
│   ├── Sidebar.tsx
│   ├── Sidebar.module.css          # ~60 lines
│   ├── FileTree.tsx
│   ├── FileTree.module.css         # ~120 lines
│   ├── EditorHeader.tsx
│   ├── EditorHeader.module.css     # ~40 lines
│   ├── CodeViewer.tsx
│   ├── CodeViewer.module.css       # ~30 lines
│   ├── DiffViewer.tsx
│   ├── DiffViewer.module.css       # ~30 lines
│   ├── AnnotationCard.tsx
│   ├── AnnotationCard.module.css   # ~100 lines
│   ├── FileAnnotationFooter.tsx
│   ├── FileAnnotationFooter.module.css # ~120 lines
│   ├── AnnotationSummaryPopover.tsx
│   ├── AnnotationSummaryPopover.module.css # ~100 lines
│   ├── KeyboardShortcutsModal.tsx
│   ├── KeyboardShortcutsModal.module.css # ~120 lines
│   ├── CompletionScreen.tsx
│   ├── CompletionScreen.module.css # ~180 lines
│   ├── IconToggle.tsx
│   ├── IconToggle.module.css       # ~40 lines
│   ├── CountBadge.tsx
│   ├── CountBadge.module.css       # ~50 lines
│   ├── StatusBadge.tsx
│   ├── StatusBadge.module.css      # ~30 lines
│   ├── KeyboardHint.tsx
│   └── KeyboardHint.module.css     # ~30 lines
└── hooks/
    ├── useEditorInteraction.ts
    └── InlineAnnotation.module.css # ~150 lines (hook-created DOM)
```

---

## Special Considerations

### InlineAnnotation (Hook-based)
The inline annotation DOM is created dynamically in `useEditorInteraction.ts` via CodeMirror widgets. When migrating to CSS Modules:
- Import styles in the hook file
- Use `styles.className` for dynamic class application
- May need to pass class names as parameters or use CSS custom properties

### CodeMirror Overrides
Some styles target CodeMirror's internal classes (`.cm-*`). These must remain global:
- `.cm-selectedAnnotationLine`
- `.cm-lineNumbers .cm-gutterElement`
- `.cm-line-selecting`
- `.codemirror-container .cm-editor`
- `.codemirror-container .cm-scroller`

### State Classes
Classes like `editing`, `highlighted`, `selected`, `active`, `empty`, `loading`, `error` are used as state modifiers. In CSS Modules:
- Keep as separate classes: `styles.editing`
- Or use CSS custom properties for state-driven styling

---

## Estimated Impact After Migration

| Metric | Before | After |
|--------|--------|-------|
| globals.css lines | 2,734 | ~400 |
| Total CSS lines | 2,734 | ~1,400 |
| CSS files | 1 | ~18 |
| Scoped styles | 0% | ~85% |
| Duplicated patterns | 16+ | 0 |
