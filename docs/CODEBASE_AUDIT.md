# Canon Codebase Audit Report

**Date:** 2026-02-05
**Version Audited:** 0.3.0
**Auditor:** Claude Code

---

## Executive Summary

This comprehensive audit of the Canon codebase identified **65 specific issues** across 9 categories. The codebase demonstrates strong fundamentals with good TypeScript practices (zero `any` types), proper React patterns, and a well-designed architecture. However, there are significant opportunities for improvement in code consistency, CSS organization, and error handling.

### Severity Distribution
| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 5 | Must fix - affects functionality/maintainability |
| High | 18 | Should fix - significant technical debt |
| Medium | 27 | Worth fixing - improves code quality |
| Low | 15 | Nice to have - minor improvements |

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
10. [Appendix: Files Requiring Most Attention](#appendix-files-requiring-most-attention)

---

## 1. Server & CLI Issues

### ~~1.1 Error Handling Inconsistencies~~ PARTIALLY RESOLVED

**Severity: HIGH** | **Status: 1.1.1 and 1.1.3 FIXED**

#### ~~1.1.1 Inconsistent API Response Status Codes~~ FIXED
Added `{ status: 400 }` to `/api/git/original/:path` error response.

#### 1.1.2 Different Error Response Structures
| Module | Error Pattern |
|--------|---------------|
| `files.ts` | `{ content: '', lineCount: 0, error?: string }` |
| `git.ts` | `{ content: '', error?: string }` |
| `server/index.ts` | `Response.json({ error: result.error })` |

**Recommendation:** Standardize on consistent error response structure across all modules.

#### ~~1.1.3 Silent Failures~~ FIXED
Added `console.warn` to browser-open catch block.

### 1.2 Async/Await Pattern Inconsistency — WON'T FIX

**Severity: MEDIUM** | **Status: WON'T FIX** (sync file I/O is appropriate for Bun's performance model; mixing sync/async is idiomatic here)

- `files.ts`: ALL functions are synchronous (uses `readFileSync`, `readdirSync`)
- `git.ts`: ALL functions are async (uses `Bun.spawn`)
- `server/index.ts`: MIXED - sync and async handlers in same fetch function

### 1.3 Large Fetch Handler Monolith — WON'T FIX

**Severity: MEDIUM** | **Status: WON'T FIX** (handler is sequential and readable; routing abstraction adds complexity without proportional benefit for this server size)

**Location:** `src/server/index.ts:39-108`

Single fetch handler with 10 sequential if statements handling multiple concerns (file serving, git operations, API endpoints).

---

## 2. React Component Issues

### ~~2.1 Unused Custom Hook~~ RESOLVED

**Severity: HIGH** | **Status: FIXED**

Deleted unused `useAutoResizeTextarea.ts` hook file. Inline implementations remain where needed (imperative DOM code cannot use React hooks).

### 2.2 Excessive Props in EditorHeader — WON'T FIX

**Severity: MEDIUM** | **Status: WON'T FIX** (9 props is reasonable for this component; splitting would add indirection without clear benefit)

**Location:** `src/web/components/EditorHeader.tsx`

### 2.3 Keyboard Event Handler Fragmentation — WON'T FIX

**Severity: MEDIUM** | **Status: WON'T FIX** (handlers are co-located with the components that own them; centralizing would increase coupling)

Keyboard event handling is spread across 4 locations, each contextually appropriate for its component.

### 2.4 App.tsx State Proliferation — WON'T FIX

**Severity: MEDIUM** | **Status: WON'T FIX** (local state in App.tsx is appropriate; moving to Context would add indirection for values only used here)

App.tsx has 8 local state values that are either derived or only consumed locally.

---

## 3. State Management Issues

### 3.1 LayoutContext State Fragmentation — WON'T FIX

**Severity: MEDIUM** | **Status: WON'T FIX** (individual `useState` calls are idiomatic React; `useReducer` would add boilerplate without measurable perf gain at this scale)

9 separate `useState` calls in LayoutContext. Re-renders are acceptable given the component tree size.

### ~~3.2 toggleEditorFullscreen Dependency Issue~~ RESOLVED

**Severity: MEDIUM** | **Status: FIXED**

Added `sidebarVisibleRef` to read current sidebar state without capturing it as a dependency. `toggleEditorFullscreen` now has `[]` dependencies, eliminating unnecessary `useEffect` re-registrations.

---

## 4. TypeScript Type Issues

### ~~4.1 Type Duplication Opportunities~~ PARTIALLY RESOLVED

**Severity: MEDIUM** | **Status: PARTIALLY FIXED**

Extracted `ViewMode` and `CompletionType` to `src/shared/types.ts`. Updated `App.tsx`, `EditorHeader.tsx`, and `CompletionScreen.tsx` to use the shared types.

DiffStats consolidation deferred (internal to git.ts, low impact).

### ~~4.2 IconToggle Tuple Enforcement~~ RESOLVED

**Severity: LOW** | **Status: FIXED**

Added `readonly` to tuple type: `readonly [ToggleOption<T>, ToggleOption<T>]`.

### ~~4.3 Unsafe Type Assertion~~ RESOLVED

**Severity: LOW** | **Status: FIXED**

Replaced `as keyof typeof styles` cast with an explicit `statusStyles` lookup record that maps status strings to CSS module classes with a safe fallback.

### 4.4 Missing Type Definitions — PARTIALLY RESOLVED

**Status:** `ViewMode` and `CompletionType` extracted to `shared/types.ts` (see 4.1). Remaining types (`LineRange`, `BadgeVariant`) are each used in only one location — extraction would add indirection without reducing duplication. **WON'T FIX** remaining.

---

## 5. CSS & Styling Issues

### 5.1 Naming Convention Inconsistency — DEFERRED

**Severity: HIGH** | **Status: DEFERRED** (high-effort, moderate regression risk, cosmetic-only impact)

| File | Convention | Example |
|------|------------|---------|
| `base.module.css` | camelCase | `.cardEditing`, `.cardNew` |
| `globals.css` | kebab-case | `.inline-annotation`, `.inline-annotation-wrapper` |
| Component modules | Mixed | Mostly camelCase |

**Note:** The kebab-case in `globals.css` is used by imperative DOM code (`inlineAnnotations.ts`) which sets `className` strings directly. Renaming those would require updating both the CSS and the JS class name strings. CSS module files already mostly use camelCase. The risk of breaking class name references across the codebase outweighs the cosmetic benefit.

### ~~5.2 Duplicate CSS Patterns~~ PARTIALLY RESOLVED

**Severity: HIGH** | **Status: Badge and textarea deduplication FIXED**

#### ~~Badge Styling~~ FIXED (2 of 4)
- `AnnotationSummaryPopover.module.css` now uses `composes: lineBadge from base.module.css`
- `FileAnnotationFooter.module.css` now uses `composes: lineBadge from base.module.css` (retains unique `gap: 4px`)
- `globals.css` `.inline-annotation-badge` must remain separate (imperative DOM cannot use CSS modules)
- `base.module.css` `.lineBadge` is the canonical source

#### ~~Textarea Styling~~ FIXED (1 of 4)
- `FileAnnotationFooter.tsx` now uses `baseStyles.cardTextarea` className directly
- `globals.css` `.inline-annotation-textarea` must remain separate (imperative DOM)
- `App.module.css` `.annotationModalTextarea` has legitimate differences (bordered, larger, resizable)

#### Action Button Styling (unchanged - legitimate variations)
- `globals.css` `.inline-annotation-action` — imperative DOM, must remain
- `base.module.css` `.actionIcon` — canonical CSS module source
- `App.module.css` buttons have different sizes/shapes for their contexts

#### Keyframe Animations (intentional duplication)
CSS Modules scope `@keyframes` names, so each module must define its own copy (per `docs/design-guide.md`). Not a defect.

### ~~5.3 Hard-Coded Values~~ PARTIALLY RESOLVED

**Severity: MEDIUM** | **Status: Colors FIXED, border-radius DEFERRED**

#### ~~Hard-Coded Colors~~ FIXED
Added `--bg-fullscreen`, `--bg-floating`, `--overlay-backdrop` CSS variables to globals.css. Replaced all hard-coded color values in `App.module.css`, `AnnotationSummaryPopover.module.css`, and `KeyboardShortcutsModal.module.css`.

#### Hard-Coded Border Radius — DEFERRED
22 instances of hard-coded border-radius values. To be addressed as part of a future CSS design token pass.

### ~~5.4 Inconsistent Overlay Opacity~~ RESOLVED

**Status: FIXED**

All overlays now use `var(--overlay-backdrop)` (standardized at 60% opacity).

### ~~5.5 No Z-Index Management Strategy~~ RESOLVED

**Severity: MEDIUM** | **Status: FIXED**

Defined z-index scale as CSS variables in globals.css:
- `--z-float: 10` (floating headers, resize handles)
- `--z-local-overlay: 100` (overlays within fullscreen context)
- `--z-overlay: 1000` (full-page overlays)
- `--z-modal: 1001` (modals above overlays)
- `--z-top: 10000` (topmost indicators)

Replaced all hard-coded z-index values across `App.module.css`, `AnnotationSummaryPopover.module.css`, `KeyboardShortcutsModal.module.css`, `Sidebar.module.css`, and `globals.css`. Internal component stacking (z-index 1, 2) left as-is.

---

## 6. Utility Function Issues

### ~~6.1 Global Mutable State~~ RESOLVED

**Severity: CRITICAL** | **Status: FIXED**

Replaced module-level `globalCallbacks` mutable variable with a CodeMirror `Facet` (`annotationCallbacksFacet`). Widgets now read callbacks from `view.state.facet()` at event time. The hook uses a `Compartment` to reconfigure the facet when callbacks change.

### ~~6.2 Code Duplication in Utilities~~ RESOLVED

**Severity: HIGH** | **Status: FIXED**

Extracted shared helpers in both files:
- `gutterInteraction.ts`: `queryGutterElements()`, `parseLineNumber()`, `normalizeLineRange()`
- `inlineAnnotations.ts`: `createKeyboardHint()`, `setupTextareaAutoResize()`

### ~~6.3 Unsafe DOM Navigation~~ RESOLVED

**Severity: MEDIUM** | **Status: FIXED**

Replaced non-null assertion `inner.parentElement!` with null check and early return.

### 6.4 Missing Documentation — WON'T FIX

**Severity: MEDIUM** | **Status: WON'T FIX** (code is self-documenting; adding JSDoc to these internal utilities would be low-value overhead)

### ~~6.5 Focus Timing Inconsistency~~ RESOLVED

**Severity: LOW** | **Status: FIXED**

Added comment explaining the intentional difference: edit mode replaces existing DOM (direct focus works), while new annotation widgets are inserted by CodeMirror and need a frame to mount before focus.

---

## 7. Build & Configuration Issues

### ~~7.1 Documentation/Implementation Mismatch~~ RESOLVED

**Severity: CRITICAL** | **Status: FIXED**

Updated `CLAUDE.md` build commands to match actual `package.json` script names (`build:linux-x64`, `build:linux-arm64`, `build:darwin-arm64`, `build:windows-x64`). Removed non-existent `build:mac-x64`.

### ~~7.2 Loose Version Pinning~~ RESOLVED

**Severity: HIGH** | **Status: FIXED**

Pinned `@types/bun` to `^1.3.8` in package.json. Pinned `bun-version` to `1.3.8` in CI workflow.

### 7.3 Outdated Dependencies — WON'T FIX

**Severity: MEDIUM** | **Status: WON'T FIX** (major version upgrades carry breaking change risk; current versions are stable and functional)

---

## 8. Code Duplication

### 8.1 High-Priority Duplications

| Pattern | Occurrences | Location | Status |
|---------|-------------|----------|--------|
| Badge styling | 4 | CSS files | 2 of 4 consolidated via `composes` |
| Textarea styling | 4 | CSS files | 1 of 4 consolidated via className |
| Action button styling | 4 | CSS files | Legitimate variations |
| Card container styling | 4 | CSS files | Legitimate variations |
| ~~Auto-resize textarea logic~~ | ~~2~~ | ~~JS files~~ | **FIXED** — `setupTextareaAutoResize()` |
| ~~Keyboard hint DOM creation~~ | ~~2~~ | ~~inlineAnnotations.ts~~ | **FIXED** — `createKeyboardHint()` |
| ~~Line range normalization~~ | ~~3~~ | ~~gutterInteraction.ts~~ | **FIXED** — `normalizeLineRange()` |
| ~~Gutter element query~~ | ~~3~~ | ~~gutterInteraction.ts~~ | **FIXED** — `queryGutterElements()` |
| Keyframe animations | 10+ | CSS files | Intentional (CSS Modules scoping) |

### ~~8.2 Path Decoding in Server~~ RESOLVED

**Status: FIXED**

Extracted `extractPathParam(url, prefix)` helper. Both call sites now use it.

### 8.3 Duplicate Annotation Grouping Logic — FALSE POSITIVE

**Status: WON'T FIX** (no duplication exists)

`AnnotationContext.tsx` imports and calls `groupAnnotationsByFile()` from `annotationUtils.ts` — it does not reimplement it. Both `getAnnotationsGroupedByFile()` and `formatAsXml()` are clean delegation.

---

## 9. Documentation Issues

### ~~9.1 Outdated CLAUDE.md~~ RESOLVED

**Status: FIXED**

- ~~Build script names don't match package.json~~ **FIXED** (Critical 7.1)
- ~~Missing environment variables~~ **FIXED** — added `CANON_PORT` and `CANON_REMOTE` documentation
- ~~Stale hook reference~~ **FIXED** — updated `useAutoResizeTextarea` → `useInlineAnnotations`
- API endpoint table was already accurate

### 9.2 Missing Code Documentation — WON'T FIX

**Status: WON'T FIX** (same items as 6.4 — code is self-documenting; adding JSDoc to internal utilities is low-value overhead)

---

## Appendix: Files Requiring Most Attention

| File | Issues | Status |
|------|--------|--------|
| `src/server/index.ts` | ~~Error handling~~, ~~path decoding~~ | Fixed (route org won't fix) |
| `src/web/context/LayoutContext.tsx` | ~~toggleEditorFullscreen dep~~ | Fixed (state fragmentation won't fix) |
| `src/web/utils/inlineAnnotations.ts` | ~~Global state~~, ~~duplication~~, ~~DOM guard~~, ~~focus comment~~ | All fixed |
| `src/web/utils/gutterInteraction.ts` | ~~Duplication~~ | Fixed (docs won't fix) |
| `src/web/styles/globals.css` | ~~Hard-coded colors~~, ~~z-index~~ | Fixed (naming deferred) |
| `src/web/App.tsx` | ~~Type duplication~~ | Fixed (state proliferation won't fix) |
| `src/web/components/EditorHeader.tsx` | Props count | Won't fix |
| `CLAUDE.md` | ~~Script names~~, ~~env vars~~, ~~stale hook ref~~ | All fixed |
| `package.json` | ~~Version pinning~~ | Fixed |

---

*Report generated by Claude Code audit on 2026-02-05*
