# CSS Audit: globals.css

**Date:** 2026-02-05
**File:** `src/web/styles/globals.css`

## Summary

| Metric | Count |
|--------|-------|
| Total lines | **2,530** |
| Unique CSS classes | **~291** |
| Keyframe animations | **21** |
| Radial gradient instances | **16** |
| React components (for comparison) | 15 files, 1,610 lines |

**The CSS file is 57% larger than all React components combined.** This is disproportionate for a project of this size.

---

## Why It's So Large

### 1. Heavy Duplication of Annotation Styles

Four nearly identical card patterns with the same gradients, borders, padding, and hover states:

| Class | Lines |
|-------|-------|
| `.annotation-card` | 815-897 |
| `.inline-annotation` | 1823-1858 |
| `.file-annotation-card` | 1171-1193 |
| `.summary-annotation` | 1501-1519 |

### 2. Duplicated Button Patterns

Three separate button classes that are essentially identical:

| Class | Lines |
|-------|-------|
| `.annotation-action-btn` | 1019-1078 |
| `.inline-annotation-btn` | 2002-2051 |
| `.file-annotation-btn` | 1351-1399 |

The file even has a comment `/* Shared action button pattern */` at line 919, yet the pattern is repeated multiple times below it.

### 3. Duplicated Action Icon Buttons

Four copies of the same action button style:

- `.annotation-card-action`
- `.file-annotation-action`
- `.summary-annotation-action`
- `.inline-annotation-action`

### 4. Duplicated Badge Patterns

Three badge classes with nearly identical styles:

| Class | Lines |
|-------|-------|
| `.annotation-line-badge` | 1083-1115 |
| `.inline-annotation-badge` | 1926-1954 |
| `.file-annotation-badge` | 1202-1224 |

### 5. Verbose Radial Gradients

The same radial gradient is copy-pasted 16 times:

```css
radial-gradient(
  ellipse 200px 120px at top left,
  rgba(212, 165, 116, 0.05) 0%,
  rgba(212, 165, 116, 0.02) 40%,
  transparent 70%
)
```

### 6. Excessive Keyframe Animations (21 total)

Many are minor variations of fade/slide effects that could be consolidated or parameterized.

---

## Recommendations

### Option A: Consolidate with Base Classes + Modifiers

Create shared base classes and use modifiers:

```css
/* One base card style */
.card {
  position: relative;
  padding: var(--space-4) var(--space-5);
  background: var(--gradient-card);
  border: 1px solid var(--accent-gold-muted);
  border-radius: 8px;
  transition: all 0.25s ease;
}
.card:hover { border-color: var(--accent-gold); }
.card--annotation { /* annotation-specific tweaks */ }
.card--inline { /* inline-specific tweaks */ }

/* One base action button */
.action-btn { /* shared styles */ }
.action-btn--small { /* size variant */ }
.action-btn--delete:hover { color: var(--status-error); }
```

**Estimated reduction: 30-40%**

### Option B: CSS Custom Properties for Repeated Values

Extract repeated gradients into variables:

```css
:root {
  --gradient-card: radial-gradient(
    ellipse 200px 120px at top left,
    rgba(212, 165, 116, 0.05) 0%,
    rgba(212, 165, 116, 0.02) 40%,
    transparent 70%
  );
  --gradient-card-hover: radial-gradient(
    ellipse 200px 120px at top left,
    rgba(212, 165, 116, 0.08) 0%,
    rgba(212, 165, 116, 0.03) 40%,
    transparent 70%
  );
}
```

### Option C: Consider CSS Modules or Styled Components

Since the project uses React, CSS Modules would:

- Scope styles per component
- Reduce the monolithic file
- Make it easier to delete unused styles
- Enable composition patterns

### Option D: Remove Unused Styles

Audit which classes are actually used. With 291 classes for 15 components, some are likely orphaned.

### Option E: Reduce Animation Complexity

Consolidate similar keyframes using CSS custom properties:

```css
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(var(--slide-distance, -6px));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## Realistic Target

With consolidation and deduplication, this file could reasonably be **1,200-1,500 lines** (40-50% smaller) while maintaining the same visual design.

---

## Implementation Plan

### Phase 1: Design Tokens & Variable Extraction

Extract repeated values into CSS custom properties and organize into clear categories.

**Scope:**
- Extract 16 repeated radial gradients into `--gradient-*` variables
- Consolidate 21 keyframe animations into ~8-10 reusable ones with CSS custom property parameters
- Reorganize existing `:root` variables into semantic categories:
  - Primitive colors (`--color-gold-100`, `--color-gold-200`, etc.)
  - Semantic colors (`--color-accent`, `--color-accent-hover`, etc.)
  - Spacing scale
  - Typography
  - Shadows & effects

**Example:**
```css
:root {
  /* Gradients */
  --gradient-card: radial-gradient(
    ellipse 200px 120px at top left,
    rgba(212, 165, 116, 0.05) 0%,
    rgba(212, 165, 116, 0.02) 40%,
    transparent 70%
  );
  --gradient-card-hover: radial-gradient(...);
  --gradient-card-active: radial-gradient(...);
}
```

**Expected reduction:** ~200-300 lines

---

### Phase 2: Consolidate Base Patterns

Create shared base classes with BEM-style modifiers to eliminate duplication.

**Scope:**
- Consolidate 4 card variants into `.card` base + modifiers
- Consolidate 4 action button variants into `.action-btn` base + modifiers
- Consolidate 3 badge variants into `.badge` base + modifiers
- Consolidate 3 text button variants into `.text-btn` base + modifiers

**Example:**
```css
/* One base card style */
.card {
  position: relative;
  padding: var(--space-4) var(--space-5);
  background: var(--gradient-card);
  border: 1px solid var(--accent-gold-muted);
  border-radius: 8px;
  transition: all 0.25s ease;
}
.card:hover {
  border-color: var(--accent-gold);
  background: var(--gradient-card-hover);
}
.card--editing { /* editing state */ }
.card--highlighted { /* highlighted state */ }
```

**Expected reduction:** ~400-500 lines

---

### Phase 3: Component Audit

Audit existing components and identify extraction opportunities.

**Scope:**
- List all 15 React components and their CSS dependencies
- Identify orphaned/unused CSS classes
- Identify candidates for new shared components
- Map which CSS blocks belong to which components

**Deliverable:** Component inventory table showing:
- Component name
- CSS classes used
- Shared vs component-specific styles
- Recommended module structure

---

### Phase 4: CSS Modules Migration

Split `globals.css` into scoped CSS Modules per component.

**Target structure:**
```
src/web/styles/
├── tokens.css              # Design tokens (imported globally)
├── reset.css               # Reset & base styles
├── base.module.css         # Shared .card, .btn, .badge classes
└── components/
    ├── Header.module.css
    ├── Sidebar.module.css
    ├── AnnotationCard.module.css
    ├── InlineAnnotation.module.css
    └── ...
```

**Migration approach:**
- Keep `tokens.css` and `reset.css` as global imports
- Use `composes` in CSS Modules to extend base classes
- Update React components to import their respective modules

**Example:**
```css
/* AnnotationCard.module.css */
.card {
  composes: card from '../base.module.css';
}
.card:hover {
  composes: cardHover from '../base.module.css';
}
```

```tsx
// AnnotationCard.tsx
import styles from './AnnotationCard.module.css';
<div className={styles.card}>
```

---

### Phase 5: Design Guide Documentation

Create lightweight documentation describing the design system intent.

**Location:** `docs/design-guide.md`

**Contents:**
- Color philosophy (warm charcoals, gold accents)
- Spacing principles
- Component patterns (cards, buttons, badges)
- Animation guidelines
- When to use which variant

**Principle:** Describe intent, not implementation. Keep it under 200 lines.

---

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Total CSS lines | 2,530 | < 1,500 |
| Monolithic files | 1 | 0 |
| Repeated gradients | 16 | 0 (use variables) |
| Duplicated patterns | 4+ each | 1 base + modifiers |
| Orphaned classes | Unknown | 0 |
