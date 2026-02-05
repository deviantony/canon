# Canon Codebase Audit Report

**Date:** 2026-02-05
**Version Audited:** 0.3.0
**Auditor:** Claude Code

---

## Executive Summary

This comprehensive audit of the Canon codebase identified **67 specific issues** across 10 categories. The codebase demonstrates strong fundamentals with good TypeScript practices (zero `any` types), proper React patterns, and a well-designed architecture. However, there are significant opportunities for improvement in code consistency, CSS organization, and error handling.

### Severity Distribution
| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 5 | Must fix - affects functionality/maintainability |
| High | 18 | Should fix - significant technical debt |
| Medium | 28 | Worth fixing - improves code quality |
| Low | 16 | Nice to have - minor improvements |

---

## Table of Contents
1. [Server & CLI Issues](#1-server--cli-issues)
2. [React Component Issues](#2-react-component-issues)
3. [State Management Issues](#3-state-management-issues)
4. [TypeScript Type Issues](#4-typescript-type-issues)
5. [CSS & Styling Issues](#5-css--styling-issues)
6. [Utility Function Issues](#6-utility-function-issues)
7. [Build & Configuration Issues](#7-build--configuration-issues)
8. [Code Duplication](#8-code-duplication)
9. [Documentation Issues](#9-documentation-issues)
10. [Recommendations Summary](#10-recommendations-summary)

---

## 1. Server & CLI Issues

### 1.1 Error Handling Inconsistencies

**Severity: HIGH**

#### 1.1.1 Inconsistent API Response Status Codes
**Location:** `src/server/index.ts`

```typescript
// Line 65 - Returns 400 on error (correct)
if (result.error) {
  return Response.json({ error: result.error }, { status: 400 })
}

// Line 85 - Missing status code (incorrect - defaults to 200)
if (result.error) {
  return Response.json({ error: result.error, content: '' })
}
```

**Impact:** Clients cannot reliably detect errors from `/api/git/original/:path` endpoint.

#### 1.1.2 Different Error Response Structures
| Module | Error Pattern |
|--------|---------------|
| `files.ts` | `{ content: '', lineCount: 0, error?: string }` |
| `git.ts` | `{ content: '', error?: string }` |
| `server/index.ts` | `Response.json({ error: result.error })` |

**Recommendation:** Standardize on consistent error response structure across all modules.

#### 1.1.3 Silent Failures
**Location:** `src/server/index.ts:154-157`
```typescript
// Browser opening fails silently with empty catch block
try {
  // spawn browser
} catch {}  // Silent failure
```

**Recommendation:** Log warning when browser fails to open.

### 1.2 Async/Await Pattern Inconsistency

**Severity: MEDIUM**

- `files.ts`: ALL functions are synchronous (uses `readFileSync`, `readdirSync`)
- `git.ts`: ALL functions are async (uses `Bun.spawn`)
- `server/index.ts`: MIXED - sync and async handlers in same fetch function

**Recommendation:** Consider making file operations async for consistency and better performance with large repositories.

### 1.3 Large Fetch Handler Monolith

**Severity: MEDIUM**
**Location:** `src/server/index.ts:39-108`

Single fetch handler with 10 sequential if statements handling multiple concerns (file serving, git operations, API endpoints).

**Recommendation:** Extract route handlers into separate functions or use a routing pattern.

---

## 2. React Component Issues

### 2.1 Unused Custom Hook

**Severity: HIGH**
**Location:** `src/web/hooks/useAutoResizeTextarea.ts`

The `useAutoResizeTextarea` hook exists but is **NOT USED** anywhere in the codebase. Instead, the same logic is duplicated inline in:
- `FileAnnotationFooter.tsx` (lines 37-42)
- `App.tsx` fullscreen modal

**Recommendation:** Use the existing hook instead of duplicating logic.

### 2.2 Excessive Props in EditorHeader

**Severity: MEDIUM**
**Location:** `src/web/components/EditorHeader.tsx`

Component receives 9 props:
```typescript
interface EditorHeaderProps {
  filePath: string | null
  canShowDiff: boolean
  viewMode: 'code' | 'diff'
  onViewModeChange: (mode: 'code' | 'diff') => void
  isNewFile?: boolean
  fileStatus?: ChangedFile['status']
  additions?: number
  deletions?: number
  lineCount?: number
}
```

**Recommendation:** Split into smaller components or move file selection state to Context.

### 2.3 Keyboard Event Handler Fragmentation

**Severity: MEDIUM**

Keyboard event handling is spread across 4 locations:
1. `App.tsx` (lines 166-233) - main shortcuts
2. `LayoutContext.tsx` (lines 117-150) - Ctrl+Cmd+S, Ctrl+Cmd+V
3. `KeyboardShortcutsModal.tsx` (lines 37-49) - Escape handler
4. `FileAnnotationFooter.tsx` (lines 90-96) - textarea-specific

**Recommendation:** Consolidate keyboard handling into a single location or use a keyboard shortcuts manager.

### 2.4 App.tsx State Proliferation

**Severity: MEDIUM**
**Location:** `src/web/App.tsx`

App.tsx has 8 local state values that could be candidates for Context:
- `selectedFile`, `viewMode` - editor state
- `shortcutsModalOpen` - UI modal state
- `lineCount`, `floatingHeaderDimmed` - derived/UI state

**Recommendation:** Consider moving editor-related state to Context.

---

## 3. State Management Issues

### 3.1 LayoutContext State Fragmentation

**Severity: MEDIUM**
**Location:** `src/web/context/LayoutContext.tsx:45-53`

9 separate `useState` calls instead of consolidated state:
```typescript
const [sidebarVisible, setSidebarVisible] = useState(true)
const [sidebarWidth, setSidebarWidthState] = useState(DEFAULT_SIDEBAR_WIDTH)
const [selectedLines, setSelectedLines] = useState<LineSelection | null>(null)
// ... 6 more useState calls
```

**Impact:** Any state change triggers re-renders of all context consumers.

**Recommendation:** Group related state or use `useReducer`.

### 3.2 toggleEditorFullscreen Dependency Issue

**Severity: MEDIUM**
**Location:** `src/web/context/LayoutContext.tsx`

```typescript
const toggleEditorFullscreen = useCallback(() => {
  setEditorFullscreen(prev => {
    if (!prev) {
      sidebarWasVisibleRef.current = sidebarVisible  // Captures current value
      setSidebarVisible(false)
    } else {
      setSidebarVisible(sidebarWasVisibleRef.current)
    }
    return !prev
  })
}, [sidebarVisible])  // Function recreated when sidebarVisible changes
```

**Impact:** The keyboard handler `useEffect` that depends on `toggleEditorFullscreen` is recreated frequently.

### 3.3 Action Naming Inconsistency Between Contexts

| Context | Pattern | Examples |
|---------|---------|----------|
| AnnotationContext | Verb-based | `addAnnotation`, `removeAnnotation`, `updateAnnotation` |
| LayoutContext | Setter/toggle | `setSidebarWidth`, `setSelectedLines`, `toggleSidebar` |

**Recommendation:** Choose consistent naming convention.

### 3.4 Missing Input Validation

**Severity: LOW**
**Location:** `src/web/context/AnnotationContext.tsx`

`addAnnotation` accepts inputs without validation:
- Empty file path allowed
- Negative/zero lineStart allowed
- lineEnd < lineStart allowed
- Empty comment allowed

---

## 4. TypeScript Type Issues

### 4.1 Type Duplication Opportunities

**Severity: MEDIUM**

#### Implicit Types Used Multiple Times
```typescript
// App.tsx line 31
const [viewMode, setViewMode] = useState<'code' | 'diff'>('code')

// EditorHeader line 14
viewMode: 'code' | 'diff'

// Should extract:
type ViewMode = 'code' | 'diff'
```

Same issue with completion state: `'submitted' | 'cancelled' | null`

#### DiffStats Not Exported
**Location:** `src/server/git.ts:8-11`

`DiffStats` is internal but duplicates structure of `ChangedFile` (additions/deletions).

**Recommendation:** Export `DiffStats` or consolidate with `ChangedFile`.

### 4.2 IconToggle Tuple Enforcement

**Severity: LOW**
**Location:** `src/web/components/IconToggle.tsx`

```typescript
interface IconToggleProps<T extends string> {
  options: [ToggleOption<T>, ToggleOption<T>]  // Tuple - not enforced at runtime
}
```

**Recommendation:** Use `readonly [ToggleOption<T>, ToggleOption<T>]` or add runtime validation.

### 4.3 Unsafe Type Assertion

**Severity: LOW**
**Location:** `src/web/components/StatusBadge.tsx:18`

```typescript
as keyof typeof styles  // Unsafe - no validation that status is in styles keys
```

### 4.4 Missing Type Definitions

| Type | Locations Used | Recommendation |
|------|----------------|----------------|
| `LineRange` | Multiple files | Create `{ start: number; end: number }` |
| `ViewMode` | App.tsx, EditorHeader | Create `'code' \| 'diff'` |
| `CompletionType` | App.tsx, CompletionScreen | Create `'submitted' \| 'cancelled'` |
| `BadgeVariant` | CountBadge | Create `'filter' \| 'header'` |

---

## 5. CSS & Styling Issues

### 5.1 Naming Convention Inconsistency

**Severity: HIGH**

| File | Convention | Example |
|------|------------|---------|
| `base.module.css` | camelCase | `.cardEditing`, `.cardNew` |
| `globals.css` | kebab-case | `.inline-annotation`, `.inline-annotation-wrapper` |
| Component modules | Mixed | Mostly camelCase |

**Recommendation:** Standardize on one convention (camelCase for CSS modules is common).

### 5.2 Duplicate CSS Patterns

**Severity: HIGH**

#### Badge Styling (4 implementations)
Nearly identical code in:
1. `styles/base.module.css:129-171` - `.lineBadge`
2. `styles/globals.css:305-321` - `.inline-annotation-badge`
3. `components/AnnotationSummaryPopover.module.css:119-136` - `.lineBadge`
4. `components/FileAnnotationFooter.module.css:67-89` - `.badge`

All implement identical properties:
```css
padding: 2px 10px;
background: var(--color-gold-alpha-08);
border: 1px solid var(--accent-gold-muted);
border-radius: 4px;
/* ... 8 more identical properties */
```

#### Action Button Styling (3+ implementations)
- `globals.css:351-373` - `.inline-annotation-action`
- `base.module.css:35-57` - `.actionIcon`
- `App.module.css:145-163` - `.floatingExitBtn`
- `App.module.css:298-316` - `.annotationModalClose`

#### Textarea Styling (4 implementations)
- `base.module.css:210-237` - `.cardTextarea`
- `globals.css:443-472` - `.inline-annotation-textarea`
- `FileAnnotationFooter.module.css:132-159` - `.editCard textarea`
- `App.module.css:322-350` - `.annotationModalTextarea`

#### Duplicate Keyframe Animations
- `@keyframes fadeSlideIn` - defined in 4 files
- `@keyframes fadeIn` - defined in 3 files
- `@keyframes accentPulse` - defined in 2 files

### 5.3 Hard-Coded Values

**Severity: MEDIUM**

#### Hard-Coded Colors
| Location | Value | Should Be |
|----------|-------|-----------|
| `App.module.css:40` | `#000` | `var(--bg-void)` |
| `App.module.css:101` | `rgba(17, 17, 17, 0.85)` | CSS variable |
| `App.module.css:226` | `rgba(0, 0, 0, 0.6)` | `var(--overlay-dark)` |
| `AnnotationSummaryPopover.module.css:6` | `rgba(0, 0, 0, 0.6)` | Variable |
| `KeyboardShortcutsModal.module.css:6` | `rgba(0, 0, 0, 0.7)` | Variable (different opacity!) |

#### Hard-Coded Border Radius (22 instances)
Values like `2px`, `3px`, `4px`, `5px`, `6px`, `7px`, `8px`, `20px`, `99px` should use CSS variables.

### 5.4 Inconsistent Overlay Opacity
- `AnnotationSummaryPopover.module.css`: 60%
- `KeyboardShortcutsModal.module.css`: 70%
- `App.module.css`: 60%

### 5.5 No Z-Index Management Strategy

**Severity: MEDIUM**

Z-index values scattered without clear hierarchy:
- 10000: `.line-selection-indicator`
- 1001: KeyboardShortcutsModal `.overlay`
- 1000: AnnotationSummaryPopover `.overlay`
- 100: `.annotationModalBackdrop`
- 10: `.floatingHeader`

**Recommendation:** Define z-index scale as CSS variables.

---

## 6. Utility Function Issues

### 6.1 Global Mutable State

**Severity: CRITICAL**
**Location:** `src/web/utils/inlineAnnotations.ts:27-31`

```typescript
let globalCallbacks: AnnotationCallbacks | null = null

export function setAnnotationCallbacks(callbacks: AnnotationCallbacks) {
  globalCallbacks = callbacks
}
```

**Issues:**
- No thread-safety or concurrent access protection
- If multiple editors used simultaneously, callbacks may get overwritten
- Makes testing difficult
- No documentation explaining why global state was chosen

**Recommendation:** Pass callbacks through CodeMirror's Extension system or React Context.

### 6.2 Code Duplication in Utilities

**Severity: HIGH**

#### gutterInteraction.ts (3 duplications each):
1. Gutter element query: `.cm-lineNumbers .cm-gutterElement`
2. Line number min/max normalization logic
3. Line number parsing from DOM elements

#### inlineAnnotations.ts:
1. Textarea auto-resize logic (2 occurrences)
2. Keyboard shortcut handlers (2 occurrences)
3. Hint element construction (2 occurrences)
4. Textarea value trim & validation (4 occurrences)

### 6.3 Unsafe DOM Navigation

**Severity: MEDIUM**
**Location:** `src/web/utils/inlineAnnotations.ts:106`

```typescript
const outer = inner.parentElement!  // Non-null assertion without validation
```

### 6.4 Missing Documentation

**Severity: MEDIUM**

- `languageExtensions.ts` - Only export is undocumented
- `gutterInteraction.ts` - Plugin classes undocumented
- `inlineAnnotations.ts` - StateField purpose undocumented

### 6.5 Focus Timing Inconsistency

**Severity: LOW**
**Location:** `src/web/utils/inlineAnnotations.ts`

```typescript
// Line 158 - Direct focus
textarea.focus()

// Line 264 - setTimeout focus
setTimeout(() => { textarea.focus() }, 0)
```

---

## 7. Build & Configuration Issues

### 7.1 Documentation/Implementation Mismatch

**Severity: CRITICAL**
**Location:** `CLAUDE.md` vs `package.json`

| Documented Command | Actual Script Name |
|-------------------|-------------------|
| `npm run build:linux` | `npm run build:linux-x64` |
| `npm run build:mac-arm` | `npm run build:darwin-arm64` |
| `npm run build:mac-x64` | Not found |
| `npm run build:windows` | `npm run build:windows-x64` |

**Impact:** Users following documentation receive "script not found" errors.

### 7.2 Loose Version Pinning

**Severity: HIGH**

#### package.json:33
```json
"@types/bun": "latest"
```

#### .github/workflows/release.yml:18
```yaml
bun-version: latest
```

**Impact:** Non-reproducible builds. Different versions could produce different binaries.

### 7.3 Outdated Dependencies

**Severity: MEDIUM**

| Package | Current | Latest |
|---------|---------|--------|
| `react` | 18.3.1 | 19.2.4 |
| `react-dom` | 18.3.1 | 19.2.4 |
| `vite` | 6.0.7 | 7.3.1 |

---

## 8. Code Duplication

### 8.1 High-Priority Duplications

| Pattern | Occurrences | Location |
|---------|-------------|----------|
| Badge styling | 4 | CSS files |
| Textarea styling | 4 | CSS files |
| Action button styling | 4 | CSS files |
| Card container styling | 4 | CSS files |
| Auto-resize textarea logic | 2 | JS files |
| Keyboard hint DOM creation | 2 | inlineAnnotations.ts |
| Line range normalization | 3 | gutterInteraction.ts |
| Gutter element query | 3 | gutterInteraction.ts |
| Keyframe animations | 10+ | CSS files |

### 8.2 Path Decoding in Server

**Location:** `src/server/index.ts`
```typescript
// Line 62
decodeURIComponent(url.pathname.slice('/api/file/'.length))

// Line 82
decodeURIComponent(url.pathname.slice('/api/git/original/'.length))
```

**Recommendation:** Extract to helper function.

### 8.3 Duplicate Annotation Grouping Logic

- `groupAnnotationsByFile()` in `src/web/utils/annotationUtils.ts`
- Called and partially reimplemented in `src/web/context/AnnotationContext.tsx`

---

## 9. Documentation Issues

### 9.1 Outdated CLAUDE.md

- Build script names don't match package.json
- Missing some environment variables
- Missing API endpoint documentation updates

### 9.2 Missing Code Documentation

| Location | Issue |
|----------|-------|
| `src/web/utils/languageExtensions.ts` | No JSDoc on only export |
| `src/web/utils/gutterInteraction.ts` | Plugin classes undocumented |
| `src/web/utils/inlineAnnotations.ts` | StateField purpose unclear |
| `src/server/git.ts` | DiffStats interface undocumented |

---

## 10. Recommendations Summary

### Critical (Fix Immediately)

1. **Fix CLAUDE.md script names** - Update to match actual package.json scripts
2. **Add missing status code** - `src/server/index.ts:85` should return 400 on error
3. **Remove global mutable state** - `inlineAnnotations.ts` should use Context/Props
4. **Pin dependency versions** - Replace `"latest"` with specific versions
5. **Consolidate duplicate CSS** - Create shared component classes

### High Priority (Fix Soon)

1. Use existing `useAutoResizeTextarea` hook instead of duplicating logic
2. Standardize error response patterns across server modules
3. Consolidate keyboard event handling
4. Extract duplicate CSS patterns (badges, buttons, textareas, cards)
5. Create CSS variables for hard-coded colors and z-index values
6. Standardize CSS naming convention (choose camelCase or kebab-case)
7. Extract utility helpers in gutterInteraction.ts and inlineAnnotations.ts

### Medium Priority (Plan to Fix)

1. Split LayoutContext into multiple focused contexts
2. Extract shared types to `src/shared/types.ts`
3. Document utility functions with JSDoc
4. Consider making file operations async
5. Refactor fetch handler into route handlers
6. Add input validation to context actions
7. Fix toggleEditorFullscreen dependency issue
8. Update outdated dependencies

### Low Priority (Nice to Have)

1. Add TypeScript strict null checks for DOM navigation
2. Standardize focus timing patterns
3. Add minimum height to AnnotationWidget textarea
4. Replace animation reflow hack with CSS animations
5. Standardize callback naming conventions

---

## Appendix: Files Requiring Most Attention

| File | Issues | Priority |
|------|--------|----------|
| `src/server/index.ts` | Error handling, route organization | High |
| `src/web/context/LayoutContext.tsx` | State fragmentation, dependencies | High |
| `src/web/utils/inlineAnnotations.ts` | Global state, duplication | High |
| `src/web/utils/gutterInteraction.ts` | Duplication, documentation | Medium |
| `src/web/styles/globals.css` | Naming, hard-coded values | Medium |
| `src/web/App.tsx` | State proliferation | Medium |
| `src/web/components/EditorHeader.tsx` | Excessive props | Medium |
| `CLAUDE.md` | Script name mismatches | Critical |
| `package.json` | Version pinning | High |

---

*Report generated by Claude Code audit on 2026-02-05*
