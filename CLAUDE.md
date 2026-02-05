# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Canon is an interactive code review tool for Claude Code sessions. It provides a browser-based annotation interface where users can review code changes and provide inline feedback that flows back into the conversation as XML.

## Development Commands

```bash
# Development (runs CLI server + Vite dev server with HMR)
make dev

# Full build: web assets → embed → compile binary
npm run build

# Build web assets only
npm run build:web

# Install binary to ~/.local/bin
make install

# Cross-platform compilation
npm run build:linux      # Linux x64
npm run build:mac-arm    # macOS ARM64
npm run build:mac-x64    # macOS x64
npm run build:windows    # Windows x64
npm run build:all        # All platforms
```

## Architecture

**Runtime**: Bun (not Node.js) - used for both development and final binary compilation.

**Build Pipeline**: Vite builds React frontend → `scripts/embed-assets.ts` generates `src/server/embedded-assets.ts` → Bun compiles everything into a single binary.

### Key Architectural Pattern

The CLI uses a Promise-based blocking pattern:
1. CLI starts HTTP server (port 9847, configurable via `CANON_PORT`)
2. Browser opens automatically (skip with `CANON_REMOTE=1`)
3. CLI blocks on `waitForDecision()` Promise in `src/cli/index.ts`
4. User submits feedback → POST to `/api/feedback` resolves the Promise
5. CLI outputs XML to stdout and exits

### Code Organization

```
src/
├── cli/index.ts          # Entry point, Promise blocking
├── server/
│   ├── index.ts          # HTTP server, API routes, asset serving
│   ├── git.ts            # Git operations (diff, status, branch)
│   ├── files.ts          # File tree, gitignore parsing
│   └── embedded-assets.ts # Auto-generated (DO NOT EDIT)
├── shared/types.ts       # Shared TypeScript interfaces
└── web/
    ├── App.tsx           # Root component
    ├── context/
    │   ├── AnnotationContext.tsx  # Annotation CRUD + XML formatting
    │   └── LayoutContext.tsx      # UI state (sidebar, selection)
    ├── components/       # React components
    ├── hooks/            # useEditorInteraction, useAutoResizeTextarea
    ├── utils/            # Gutter interaction, CodeMirror theme
    └── styles/globals.css # Design system with CSS variables
```

### Frontend State Management

Two React Context providers:
- **AnnotationContext**: Manages annotations array, provides `addAnnotation()`, `updateAnnotation()`, `deleteAnnotation()`, and `formatAsXml()` for output
- **LayoutContext**: Manages sidebar visibility/width, selected lines, edit state, and global keyboard shortcuts

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/info` | Working directory |
| `/api/files` | File tree (respects .gitignore) |
| `/api/file/:path` | File content |
| `/api/git/info` | Changed files, branch info |
| `/api/git/diff/:path` | File-specific unified diff |
| `/api/git/original/:path` | Original file content (HEAD) |
| `/api/feedback` | Submit annotations (resolves CLI Promise) |

## Key Dependencies

- **CodeMirror 6**: `@codemirror/view`, `@codemirror/state`, `@codemirror/merge` (for diff view)
- **react-arborist**: Virtualized file tree
- **lucide-react**: Icons

## Integration

Canon integrates as a Claude Code slash command via `commands/new.md`. The command `/canon:new` runs the `canon` binary and captures XML-formatted feedback output.
