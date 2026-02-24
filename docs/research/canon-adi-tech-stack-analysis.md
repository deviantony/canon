# Canon ADI: Tech Stack Analysis

**Date:** 2026-02-23
**Status:** Research Complete
**Context:** Canon's transformation from a one-shot code review tool to an Agentic Development Interface (ADI) is essentially a new product. This analysis evaluates whether the current stack is the right foundation or whether a different stack would better serve the ADI's requirements.

---

## Requirements Summary

| Requirement | Details |
|-------------|---------|
| **Performance** | Fast, snappy. No jank during streaming or panel interaction |
| **UI/UX quality** | Modern, editorial aesthetic. "Warm minimalism" with gold accents |
| **Container compatibility** | Must work with dev containers — either running inside the container, communicating via `docker exec`/SDK, or a hybrid. Flexibility on deployment model. |
| **Rich text/code** | Syntax-highlighted code, diffs with annotations, markdown with diagrams |
| **Real-time streaming** | WebSocket-driven conversation stream with live text rendering |
| **Complex layout** | Resizable panels, virtual scrolling, overlays, modals |
| **Subprocess management** | Spawn and manage `claude` CLI processes, pipe stdin/stdout/stderr |
| **Single binary** | Compile to one executable for easy installation |
| **Personal tool** | One developer, one machine. Not distributed at scale |

---

## Current Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Runtime/Server | Bun | Working (POC validated) |
| Frontend Framework | React 18 | Working (full annotation system) |
| Build | Vite | Working |
| Code Editor | CodeMirror 6 + @codemirror/merge | Working (diff, annotations, gutter interaction) |
| File Tree | react-arborist | Working |
| Styling | CSS Modules + globals.css variables | Working (complete design system) |
| Animations | CSS-only (keyframes, transitions) | Working |
| Linting/Formatting | Biome | Working |
| Binary | bun build --compile | Working |

---

## 1. Server Runtime

### Comparison

| Dimension | Bun | Node.js | Deno | Go | Rust |
|-----------|-----|---------|------|----|------|
| **Subprocess management** | Good | Excellent | Good | Excellent | Good |
| **WebSocket (native?)** | Yes, built-in | No (needs `ws`) | Yes, built-in | No (needs library) | Via framework |
| **Binary size** | 57-70 MB | 90-110 MB | 58-80 MB | **6-15 MB** | **3-15 MB** |
| **Startup time** | ~30-50ms | ~100-200ms | ~50-100ms | **~5-20ms** | **~1-5ms** |
| **Memory (steady state)** | 100-300 MB | 50-200 MB | 50-200 MB | **10-30 MB** | **5-20 MB** |
| **Shared TS types with frontend** | **Yes** | **Yes** | **Yes** | No | No |
| **Edit-build-test cycle** | **<1 sec** | ~1-3 sec | <1 sec | ~1-8 sec | ~10-30 sec |
| **Container compatibility** | Good (memory concern) | Excellent | Good (no official devcontainer feature) | **Excellent** | **Excellent** |
| **Cross-compilation** | Easy | Hard | Easy | **Trivial** | Moderate |

### Analysis

**Bun** (current): Sub-second iteration, native TypeScript, shared types between backend and frontend via `src/shared/`, native WebSocket in `Bun.serve()`, working POC. The known concerns are binary size (~60 MB, acceptable for personal tool) and potential memory spikes in containers (reported up to 1.2 GB in heavy-load scenarios, but unlikely for a single-user tool).

**Deno** is the closest alternative to Bun: native TypeScript, built-in WebSocket via `Deno.serve()` + `Deno.upgradeWebSocket()`, shared types with the frontend, and `deno compile` for single-binary output (~58 MB on ARM, similar to Bun). Subprocess management via `Deno.Command` is stable and capable — piped stdin/stdout/stderr, `.spawn()` for long-running processes, clean `.kill()`. npm compatibility is broad (React, CodeMirror, Vite all work via `npm:` specifiers). Cross-compilation is supported to all major targets. The trade-offs vs Bun: slower raw HTTP throughput (~22K req/s vs Bun's ~52K, though both are far beyond what a single-user tool needs), `--watch-hmr` has reliability issues (sometimes falls back to full restarts — [#30293](https://github.com/denoland/deno/issues/30293)), and no official dev container feature (community-provided only). The permission system (`--allow-run`, `--allow-read`, etc.) adds friction during development but can be baked into compiled binaries. One notable gap: no public PTY API ([#3994](https://github.com/denoland/deno/issues/3994), open since 2020), which means interactive CLI tools that check `isatty()` behave differently when piped — though for Canon's use case (`claude -p` with stream-json), this is a non-issue since the subprocess is explicitly non-interactive.

**Go** would be the strongest alternative: 6-15 MB binary, 10-30 MB memory, trivial cross-compilation, excellent subprocess management via goroutines. The trade-off is losing shared TypeScript types (would need protobuf or manual type sync for ~10 API endpoints) and slower iteration (~1-8 sec rebuild vs <1 sec).

**Node.js** offers the most battle-tested subprocess management but no native WebSocket server, larger binaries (90-110 MB), and slower startup. SEA (Single Executable Application) is still experimental.

**Rust** has the best performance characteristics but 10-30 second rebuild cycles make it impractical for a personal tool in active development.

### Recommendation: Stay with Bun

For a personal tool in active development, iteration speed dominates. Bun's sub-second cycle, native TypeScript, and shared types are genuine productivity advantages. The binary size (60 MB) and memory usage are acceptable for personal use. Deno is the closest drop-in alternative (same language, shared types, similar binary size) and would be the easiest migration if Bun-specific issues arise. If container memory or distribution becomes the concern, Go is the escape hatch.

---

## 2. Frontend Framework

### Comparison

| Criterion | React 19 + Vite | Svelte 5 | SolidJS | Vue 3 | Preact |
|-----------|----------------|----------|---------|-------|--------|
| **Bundle (gzip)** | ~55 KB | ~2-3 KB | ~7 KB | ~34 KB | ~4 KB |
| **Runtime perf** | Good (w/ Compiler) | Excellent | Best | Good+ | Very Good |
| **CodeMirror 6** | Excellent | Adequate | Weak | Good | Good (compat) |
| **@codemirror/merge** | Excellent | Custom needed | Custom needed | Good | Good (compat) |
| **Markdown rendering** | Excellent (react-markdown) | Adequate (mdsvex) | Weak | Good | Good (compat) |
| **Virtual scrolling** | Excellent (TanStack) | Good | Good | Good | Good (compat) |
| **Resizable panels** | Excellent (react-resizable-panels) | Good (PaneForge) | None (DIY) | Adequate | Good (compat) |
| **File tree** | Excellent (react-arborist) | DIY | DIY | Adequate | Maybe (compat) |
| **Animation** | Excellent (Motion) | Good (built-in) | Adequate | Very Good (Motion) | Weak |
| **Streaming UIs** | Proven at scale | Good | Best (theory) | Good | Very Good |
| **Migration cost** | **None** | Full rewrite | Full rewrite | Full rewrite | Low-Medium |
| **Dev satisfaction** | ~43% | ~91% | High (small n) | ~87% | Niche |

### Analysis

The ADI requires CodeMirror 6 with diff views, markdown rendering with Mermaid diagrams, virtualized scrolling, resizable panels, file trees, and polished animations. **React is the only framework where all of these exist as mature, well-maintained libraries.** In every other framework, at least 2-3 components would need to be built from scratch.

**Svelte 5** would be the strongest alternative for a greenfield project (91% developer satisfaction, tiny bundles, excellent DX). But the ecosystem gap is real: no equivalent to react-arborist, limited CodeMirror merge support, no equivalent to Motion for layout animations.

**SolidJS** has the best raw performance but the thinnest ecosystem. Building an ADI in Solid means writing many components from scratch.

The performance argument is moot at LLM streaming rates (10-100 tokens/sec) — all frameworks handle this adequately. React 19's Compiler (automatic memoization, 12-30% render time reduction in production) closes the remaining performance gap.

### Recommendation: Stay with React (upgrade to 19 + Compiler)

Ecosystem fit is decisive. The migration cost to any other framework is a full rewrite with uncertain benefit. Upgrade to React 19 and enable the React Compiler for automatic performance optimization.

---

## 3. Code/Editor Components

### Code Viewing & Diff

| Criterion | CodeMirror 6 | Monaco | Shiki |
|-----------|-------------|--------|-------|
| **Bundle (gzip)** | ~300 KB core | ~1-2 MB | ~695 KB |
| **Virtual scrolling** | Built-in | Built-in | None |
| **Annotation widgets** | Full (decorations, gutters, tooltips) | Full but rigid | None |
| **Diff support** | @codemirror/merge (excellent) | Built-in diff editor | Via transformers (display only) |
| **Theming** | CSS-based | JSON themes | VS Code themes |
| **Framework** | Vanilla (works anywhere) | Vanilla | Framework-agnostic |

**CodeMirror 6** remains the right choice for interactive code/diff viewing. Its decoration API is what makes Canon's inline annotation cards possible. Monaco is heavier and harder to customize deeply. Shiki produces beautiful output but has no interactive features.

### Markdown Rendering

| Criterion | react-markdown + rehype | MDX | Markdoc | Custom (markdown-it) |
|-----------|----------------------|-----|---------|---------------------|
| **Bundle** | ~50 KB | ~150-200 KB | ~40 KB | ~30-50 KB |
| **Mermaid support** | Via rehype-mermaid | Via plugin | Custom | Manual |
| **Code highlighting** | Via rehype-shiki | Via plugin | Custom | Manual |
| **Component override** | `components` prop | Native JSX | Custom tags | Manual |
| **Annotation hooks** | Via component overrides | Via JSX | Via custom nodes | Manual |

**react-markdown + remark/rehype** is recommended for the Documentation surface. The `components` prop allows wrapping any rendered element with annotation hooks. `rehype-shiki` provides VS Code-quality syntax highlighting in code blocks. `rehype-mermaid` handles diagrams.

### Diagram Support

| Criterion | Mermaid | beautiful-mermaid | D2 |
|-----------|---------|-------------------|-----|
| **Diagram types** | 19+ | 5 | 12+ |
| **Bundle** | ~1.5-2.5 MB (lazy-loadable) | Small (pure TS) | ~2-4 MB (WASM) |
| **CSS variable theming** | Partial | **Full** | CSS-based |
| **Claude/LLM output compatible** | Yes (standard) | Yes (same DSL) | No (different DSL) |

**Mermaid** for maximum diagram type support, with **beautiful-mermaid** as an alternative if CSS variable theming and smaller bundle matter more than covering all 19+ diagram types. Both read the same DSL, so Claude's output works with either.

### Recommendation: Keep CodeMirror, add react-markdown + Shiki + Mermaid

- **Interactive panels** (file viewer, diff viewer): CodeMirror 6 (current)
- **Rendered content** (documentation, conversation code blocks): react-markdown + rehype-shiki + Mermaid/beautiful-mermaid
- Different components for different jobs — CodeMirror for interaction, dedicated renderer for rich display

---

## 4. Styling & Animation

### CSS Methodology

| Criterion | CSS Modules | Tailwind v4 | Vanilla Extract | Panda CSS |
|-----------|-------------|-------------|----------------|-----------|
| **Runtime** | None | None | ~0.5 KB | None |
| **Type-safe tokens** | No | No | Yes | Yes |
| **Design system** | DIY (CSS vars) | @theme directive | createTheme() | defineConfig |
| **Aesthetic control** | **Maximum** | Requires effort | **Maximum** | Good |
| **Migration cost** | **None** | Full restyle | Moderate | Moderate |
| **Editorial aesthetic fit** | **Excellent** | Risk of generic look | Excellent | Good |

**CSS Modules + CSS variables** (current approach) provides zero runtime overhead, total aesthetic control, and no migration cost. Canon's design system is already well-organized with semantic tokens in `globals.css`. Tailwind would require fighting utility abstractions to achieve the subtle radial gradients and layered effects that define Canon's identity.

### Animation

| Criterion | CSS-only | Motion (LazyMotion) | GSAP |
|-----------|----------|-------------------|------|
| **Bundle** | 0 | 4.6 KB | ~69 KB |
| **Spring physics** | No | Yes | No |
| **Layout animations** | No | Yes (FLIP) | Yes (FLIP plugin) |
| **Exit animations** | No | Yes (AnimatePresence) | Manual |
| **Streaming text** | Limited | Yes (Typewriter, 1.3 KB) | Yes (SplitText) |
| **Thread** | Compositor | Main thread | Main thread |

**Selective addition of Motion** is recommended:
- `LazyMotion` + `m` components (4.6 KB) for layout animations (panel resizing, content transitions)
- `AnimatePresence` for modal/overlay entrance and exit
- `Typewriter` component (1.3 KB) for streaming text display
- Continue CSS-only for hover states, micro-interactions, and anything during streaming (compositor thread)

### Component Primitives

| Criterion | Radix UI | Headless UI | Ark UI | shadcn/ui | From Scratch |
|-----------|----------|-------------|--------|-----------|-------------|
| **Components** | 32+ | ~14 | 45+ | 50+ (styled) | N/A |
| **Styling freedom** | Total | Total | Total | Editable | Total |
| **Accessibility** | Excellent | Excellent | Excellent | Excellent | Must implement |
| **Risk of generic look** | None | None | None | High | None |
| **Resizable panels** | No | No | Yes (Splitter) | Yes | DIY |
| **Tree view** | No | No | Yes | No | DIY |

**Radix UI primitives** for Dialog, Popover, DropdownMenu, Tooltip — the components where accessibility is hardest to get right. Build simpler components (buttons, panels, cards) from scratch for full aesthetic control.

### Recommendation: CSS Modules + selective Motion + Radix primitives

No styling migration needed. Add Motion for layout animations and Radix for accessible overlays. Everything else stays as-is.

---

## 5. Recommended Stack (Final)

### Keep (validated, working)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Bun | Sub-second iteration, native TS, shared types, native WebSocket. POC validated. |
| **Framework** | React (upgrade to 19 + Compiler) | Unmatched ecosystem for this use case. Migration cost of alternatives is unjustified. |
| **Build** | Vite | Fast HMR, simple config. Already working. |
| **Code viewer** | CodeMirror 6 + @codemirror/merge | Full annotation widget support. Already deeply integrated. |
| **File tree** | react-arborist | Virtualized, working. |
| **CSS** | CSS Modules + globals.css variables | Zero runtime, total aesthetic control, complete design system. |
| **Animations (base)** | CSS-only (keyframes, transitions) | Compositor-thread performance for micro-interactions. |
| **Linting** | Biome | Already configured. |
| **Binary** | bun build --compile | Working. 60 MB acceptable for personal tool. |

### Add (new capabilities for ADI)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Markdown rendering** | react-markdown + remark-gfm + rehype-shiki | Documentation surface: rich markdown with syntax-highlighted code blocks |
| **Diagrams** | Mermaid (standard) or beautiful-mermaid (if 5 types suffice) | Documentation surface: architecture/flow diagrams |
| **Layout animations** | Motion (LazyMotion, 4.6 KB) | Resizable panel transitions, modal entrance/exit, content state changes |
| **Streaming text** | Motion Typewriter (1.3 KB) | Conversation surface: live streaming display |
| **Accessible primitives** | Radix UI (Dialog, Popover, DropdownMenu, Tooltip) | Overlays, context menus, tooltips with proper accessibility |

### Reconsider Later (if conditions change)

| Trigger | Action |
|---------|--------|
| Bun-specific bugs or instability | Deno (closest drop-in: same language, shared types, similar DX. Lowest migration cost.) |
| Container memory exceeds acceptable limits | Evaluate Go backend (6-15 MB binary, 10-30 MB RAM) |
| Need to distribute to others | Go backend (simpler build, smaller binary, no Bun dependency) |
| React ecosystem stagnates | Svelte 5 (highest dev satisfaction, but ecosystem catch-up needed) |
| Bundle size matters | Preact (4 KB runtime, React compat layer for most libraries) |

---

## Cost/Benefit Summary

| Option | Cost | Benefit |
|--------|------|---------|
| **Stay with current stack + additions** | Near zero migration. ~1 day to add Motion, Radix, react-markdown. | Ship faster. Focus effort on ADI features, not framework migration. |
| **Switch to Svelte 5** | Full rewrite (~2-4 weeks). Rebuild CodeMirror integration, file tree, annotation system. Some libraries need custom bindings. | Smaller bundles, better DX satisfaction, cleaner reactivity model. |
| **Switch to Go backend** | Rewrite server (~1 week). Lose shared TS types. Need type codegen for API. | 10x smaller binary, 10x less memory, trivial cross-compilation. |
| **Switch to Tailwind** | Restyle all components (~1-2 weeks). Risk losing editorial identity. | Faster prototyping of new components, better IDE auto-completion for utilities. |

**The current stack requires the least investment to get to a working ADI.** The additions (Motion, Radix, react-markdown, Mermaid) are incremental — they don't require rewriting anything that exists.

---

## Sources

Research conducted across 80+ sources including framework benchmarks, library documentation, npm download statistics, State of JS 2025 survey data, and production deployment reports. Key sources:

- React Compiler v1.0 production results (Meta, Sanity Studio, Wakelet)
- State of JavaScript 2025 framework retention rates
- Bun subprocess/WebSocket documentation and issue tracker
- CodeMirror 6 vs Monaco vs Shiki comparison benchmarks
- Motion (Framer Motion) bundle analysis and Typewriter component docs
- Radix UI, Headless UI, Ark UI accessibility audits
- Tailwind v4, Vanilla Extract, Panda CSS architecture comparisons
- Go vs Bun vs Node.js HTTP/WebSocket benchmarks
- Mermaid vs beautiful-mermaid vs D2 feature comparison
- Container memory reports for Bun (issue #17723) and Go baseline measurements
