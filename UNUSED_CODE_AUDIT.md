# Unused Code Audit Report

This audit identifies all unused code, variables, CSS classes, properties, and parameters in the Canon codebase.

**Validation Status**: All findings verified in second pass (2026-02-04)

---

## Summary

| Category | Count |
|----------|-------|
| Unused TypeScript exports/functions | 5 |
| Unnecessary exports (internal-only) | 7 |
| Unused function parameters | 1 |
| Unused CSS classes | 3 categories (~30 selectors) |
| Unused CSS variables | 5 |
| Unused theme colors | 5 confirmed + 2 partial |
| CSS bugs (undefined animations) | 1 |

---

## 1. Unused TypeScript/JavaScript Exports & Functions

### `src/web/context/AnnotationContext.tsx`

**`getSortedAnnotationsForFile`** (lines 28, 72-75, 129)
- Function is defined and exposed via context but never called anywhere
- Can be safely removed from the context interface and implementation

```typescript
// UNUSED - remove these lines:
getSortedAnnotationsForFile: (file: string) => Annotation[]  // line 28

const getSortedAnnotationsForFile = useCallback(              // lines 72-75
  (file: string) => sortAnnotations(annotations.filter((a) => a.file === file)),
  [annotations]
)

getSortedAnnotationsForFile,                                  // line 129
```

### `src/web/context/LayoutContext.tsx`

**`setSidebarVisible`** (lines 21, 123)
- Exposed in context interface but never called directly (sidebar visibility is only changed via `toggleSidebar`)
- Can be removed from the context interface

```typescript
// UNUSED - remove from interface (line 21):
setSidebarVisible: (visible: boolean) => void

// UNUSED - remove from provider value (line 123):
setSidebarVisible,
```

### `src/web/utils/keyboard.ts`

**`getCtrlKey`** (lines 56-58)
- Function is exported but never imported or used anywhere in the codebase

```typescript
// UNUSED - remove entire function:
export function getCtrlKey(): string {
  return isMac ? '⌃' : 'Ctrl'
}
```

### `src/server/git.ts`

**`getChangedFiles` export** (line 110)
- Function is only used internally by `getGitInfo` in the same file
- The `export` keyword is unnecessary (function should remain, just remove export)

```typescript
// Change from:
export async function getChangedFiles(workingDirectory: string): Promise<ChangedFile[]> {

// To:
async function getChangedFiles(workingDirectory: string): Promise<ChangedFile[]> {
```

### `src/web/components/AnnotationCard.tsx`

**`NewAnnotationCard` component** (lines 120-195)
- Entire component is exported but never used anywhere
- The inline annotation system uses `NewAnnotationWidget` class in `inlineAnnotations.ts` instead
- Can be completely removed along with its interface `NewAnnotationCardProps`

---

## 1b. Unnecessary Exports (Internal-Only Usage)

These items are exported but only used internally within their own module. The exports can be removed.

### `src/web/utils/gutterInteraction.ts`

| Export | Line | Status |
|--------|------|--------|
| `setLineSelection` | 5 | Only used internally |
| `setAnnotatedLines` | 6 | Only used internally |
| `lineSelectionField` | 9 | Only used internally |
| `annotatedLinesField` | 24 | Only used internally |

### `src/web/utils/inlineAnnotations.ts`

| Export | Line | Status |
|--------|------|--------|
| `setAnnotationsEffect` | 8 | Only used internally |
| `setSelectedLinesEffect` | 13 | Only used internally |
| `inlineAnnotationField` | 361 | Only used internally |

---

## 2. Unused Function Parameters

### `src/web/utils/gutterInteraction.ts`

**`onIndicatorClick` in `GutterInteractionConfig`** (line 83)
- Parameter is defined in config interface and passed from components
- But it's never actually called inside `createGutterInteractionPlugin`
- Also affects `useEditorInteraction.ts` where `handleIndicatorClick` is created but never triggers

```typescript
// UNUSED in interface (line 83):
onIndicatorClick: (line: number) => void

// UNUSED callback passed in CodeViewer.tsx (line 104):
onIndicatorClick: handleIndicatorClick,

// UNUSED callback passed in DiffViewer.tsx (line 137):
onIndicatorClick: handleIndicatorClick,

// UNUSED function in useEditorInteraction.ts (lines 57-67):
const handleIndicatorClick = useCallback(...)
```

---

## 3. Unused CSS Classes

### `src/web/styles/globals.css`

**`.content`** (lines 712-717)
- Class is defined but never used in any React component

```css
/* UNUSED - remove entire block: */
.content {
  flex: 1;
  overflow: auto;
  background: var(--bg-void);
  min-width: 0;
}
```

**`.btn-small` and all variants** (lines 1315-1364)
- None of these classes are used anywhere in the codebase:
  - `.btn-small`
  - `.btn-small svg`
  - `.btn-small.save`
  - `.btn-small.save:hover:not(:disabled)`
  - `.btn-small.save:disabled`
  - `.btn-small.cancel`
  - `.btn-small.cancel:hover`
  - `.btn-small.delete`
  - `.btn-small.delete:hover`

**`.new-annotation-whisper` and all `__*` variants** (lines 1130-1310)
- These classes are only used by the unused `NewAnnotationCard` component
- Since `NewAnnotationCard` is unused, all these CSS classes are also unused:
  - `.new-annotation-whisper`
  - `.new-annotation-whisper__body`
  - `.new-annotation-whisper__line-marker`
  - `.new-annotation-whisper__input`
  - `.new-annotation-whisper__input::placeholder`
  - `.new-annotation-whisper__input:focus`
  - `.new-annotation-whisper__input::selection`
  - `.new-annotation-whisper__actions`
  - `.new-annotation-whisper__actions.visible`
  - `.new-annotation-whisper__hint`
  - `.new-annotation-whisper__hint kbd`
  - `.new-annotation-whisper__hint span`
  - `.new-annotation-whisper__btn`
  - `.new-annotation-whisper__btn:active`
  - `.new-annotation-whisper__btn--ghost`
  - `.new-annotation-whisper__btn--ghost:hover`
  - `.new-annotation-whisper__btn--primary`
  - `.new-annotation-whisper__btn--primary:hover:not(:disabled)`
  - `.new-annotation-whisper__btn--primary:active:not(:disabled)`
  - `.new-annotation-whisper__btn--primary:disabled`
  - `@keyframes whisperAppear` (line 1145)

---

## 4. Unused CSS Variables

### `src/web/styles/globals.css`

All defined in `:root` but never used:

| Variable | Line | Definition |
|----------|------|------------|
| `--space-12` | 64 | `48px` |
| `--margin-width` | 72 | `280px` |
| `--shadow-sm` | 80 | `0 1px 2px rgba(0, 0, 0, 0.3)` |
| `--shadow-md` | 81 | `0 4px 12px rgba(0, 0, 0, 0.4)` |
| `--transition-slow` | 77 | `0.3s ease` |

---

## 5. CSS Bug: Undefined Animation

### `src/web/styles/globals.css`

**Line 1661** references an animation that doesn't exist:

```css
.summary-popover-overlay {
  /* ... */
  animation: fadeIn 0.15s ease-out;  /* BUG: fadeIn is not defined! */
}
```

**Fix:** Change `fadeIn` to `overlayFadeIn` (defined at line 2602).

**Note:** This also means `@keyframes overlayFadeIn` (line 2602) is technically "unused" since nothing references it by the correct name.

---

## 6. Unused Colors in Theme File

### `src/web/utils/codemirrorTheme.ts`

**Completely unused** (never referenced via `colors.X`):

| Color | Line | Value |
|-------|------|-------|
| `hover` | 11 | `#1a1a1a` |
| `active` | 12 | `#1e1e1e` |
| `goldBright` | 17 | `#e8c49a` |
| `warning` | 23 | `#c4a87a` |
| `info` | 24 | `#7a9fc4` |

**Partially unused** (color values appear inline in diff styles but `colors.X` reference is not used):

| Color | Line | Value | Note |
|-------|------|-------|------|
| `success` | 21 | `#7d9f7d` | Value used inline as `rgba(125, 159, 125, ...)` at lines 138, 144 |
| `error` | 22 | `#c47a7a` | Value used inline as `rgba(196, 122, 122, ...)` at lines 135, 140, 141 |

These could either be removed (if consistency isn't needed) or the inline values could be refactored to use `colors.success`/`colors.error`.

---

## 7. All Dependencies Are Used

All packages in `package.json` (both `dependencies` and `devDependencies`) are actively used in the codebase.

---

## Recommended Cleanup Actions

### High Priority (Dead Code)
1. Remove `NewAnnotationCard` component and all associated CSS (~180 lines total)
2. Remove unused `getSortedAnnotationsForFile` from AnnotationContext
3. Remove `getCtrlKey` function from keyboard.ts
4. Fix the `fadeIn` animation bug (change to `overlayFadeIn`)

### Medium Priority (Cleanup)
5. Remove `onIndicatorClick` from gutter interaction config and related code
6. Remove `setSidebarVisible` from LayoutContext interface
7. Remove export from `getChangedFiles` in git.ts
8. Remove unused CSS classes (`.content`, `.btn-small`)
9. Remove unused CSS variables
10. Remove unnecessary exports from gutterInteraction.ts (4 exports)
11. Remove unnecessary exports from inlineAnnotations.ts (3 exports)

### Low Priority (Theme Cleanup)
12. Remove unused colors from codemirrorTheme.ts `colors` object
13. Consider refactoring diff colors to use `colors.success`/`colors.error` for consistency

---

## Estimated Lines to Remove

| Category | Lines |
|----------|-------|
| TypeScript/JSX (dead code) | ~100 |
| TypeScript (unnecessary exports) | ~7 export keywords |
| CSS | ~230 |
| **Total** | **~330+ lines** |

---

## Validation Notes

All findings were validated in a second pass:
- Searched for all usages of each identified item
- Confirmed no external imports of "internal-only" exports
- Verified CSS class names are not dynamically generated
- Confirmed animation name mismatch (`fadeIn` vs `overlayFadeIn`)
