# Canon - Annotation Tool for Claude Code

A browser-based annotation tool that integrates with Claude Code sessions, enabling inline annotation of code with feedback flowing directly back into the conversation.

## Overview

Canon provides a structured annotation phase within Claude Code sessions. It can be used for:
- **Code review** - Annotate changes Claude made with specific feedback
- **Guided refactoring** - Annotate existing code to direct improvements
- **Context provision** - Point at specific lines to clarify requirements
- **Feature requests** - Annotate where new code should be added

## User Flow

When you invoke `/canon`:
1. A local web UI opens presenting your codebase
2. You browse files and add margin annotations on specific lines
3. Submitting returns annotations to the session as structured XML
4. Claude continues with concrete, line-anchored feedback

```
[Claude Code Session] → /canon → [Web UI Annotation] → [Submit] → [XML to Claude]
                                                                        ↓
                                                                  [Cycle repeats]
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Code                                                 │
│   └── /canon slash command                                  │
│         └── !`canon` (runs CLI, captures stdout)            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ CLI Binary (Bun compiled)                                   │
│   1. Check port availability                                │
│   2. Start HTTP server (Bun.serve)                          │
│   3. Open browser (or print URL for remote)                 │
│   4. await waitForDecision() ← Promise blocks here          │
│   5. Output feedback XML to stdout                          │
└─────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│ HTTP Server              │  │ Browser UI                   │
│                          │  │                              │
│  GET  /api/info          │  │  ┌─────────┬───────────────┐ │
│  GET  /api/files         │  │  │ File    │ Code viewer   │ │
│  GET  /api/file/:path    │◀─│  │ tree    │ (CodeMirror)  │ │
│  GET  /api/git/info      │  │  │         │ [Margin notes]│ │
│  GET  /api/git/diff      │  │  └─────────┴───────────────┘ │
│  GET  /api/git/diff/:path│  │         [Submit Feedback]    │
│  GET  /api/git/original  │  │                              │
│  POST /api/feedback ─────│──│  Resolves Promise            │
└──────────────────────────┘  └──────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Server | Bun.serve() |
| Distribution | bun build --compile (single binary) |
| Frontend | React 18 + TypeScript |
| Build | Vite (embedded at compile time) |
| Styling | Tailwind CSS (dark mode only) |
| Code Editor | CodeMirror 6 |
| Diff View | @codemirror/merge |
| File Tree | react-arborist (virtualized) |

## Features

### Implemented

- CLI binary with Promise-based blocking server
- Port conflict detection (prevents dual sessions)
- File tree with git status indicators (M/A/D/R)
- Toggle between changed files and all files
- CodeMirror 6 code viewer with syntax highlighting
- Diff view for changed files with gutter interaction
- Automatic switch to code view for new files (no diff available)
- Margin annotations with line range support
- File-level annotations
- Annotation summary popover with navigation
- Annotation count badges in file tree
- Keyboard shortcuts (see Keyboard Shortcuts section)
- Remote/container support (CANON_PORT, CANON_REMOTE=1)
- XML output format for structured feedback

### Not Implemented

- Annotation type tags (question/suggestion/issue/note)
- Annotation persistence (localStorage or file-based)
- Search within file tree
- Image/binary file preview
- Session history
- Code suggestions (proposed replacement text)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/info` | GET | Working directory info |
| `/api/files` | GET | File tree (respects .gitignore) |
| `/api/file/:path` | GET | File content (detects binary) |
| `/api/git/info` | GET | Changed files with status + branch info |
| `/api/git/diff` | GET | All uncommitted changes |
| `/api/git/diff/:path` | GET | File-specific unified diff |
| `/api/git/original/:path` | GET | Original file content (HEAD) |
| `/api/feedback` | POST | Submit annotations (resolves CLI Promise) |

## Output Format

Annotations are output as XML to stdout:

```xml
<code-review-feedback>
  <file path="src/components/Button.tsx">
    <annotation type="file">
      <comment>Consider splitting this component</comment>
    </annotation>
    <annotation type="line" line="15">
      <comment>Add null check here</comment>
    </annotation>
    <annotation type="range" start="20" end="25">
      <comment>This logic is duplicated from Modal.tsx</comment>
    </annotation>
  </file>
  <summary annotations="3" files="1" />
</code-review-feedback>
```

Annotation types:
- `type="file"` - File-level annotation (no line attribute)
- `type="line"` - Single line annotation (line attribute)
- `type="range"` - Line range annotation (start/end attributes)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Cmd+S` | Toggle sidebar |
| `Ctrl+Cmd+Z` | Toggle changed/all files |
| `Ctrl+Cmd+X` | Toggle diff/source view |
| `Ctrl+Cmd+C` | Focus file annotation |
| `Ctrl+Cmd+Enter` | Submit review |
| `Ctrl+Cmd+Backspace` | Cancel review |
| `Cmd+K` / `Ctrl+K` | Open keyboard shortcuts modal |
| `Escape` | Cancel current action / clear selection |

## Configuration

Environment variables:

```bash
CANON_PORT=9847        # Server port (default: 9847)
CANON_REMOTE=1         # Skip browser auto-open (for container/SSH)
```

## Session Behavior

Canon binds to a fixed port. Only one review session can be active at a time.

| Scenario | Behavior |
|----------|----------|
| Port already in use | Fail with error message |
| Browser tab closed | Can reopen URL while CLI blocks |
| Ctrl+C in terminal | Server shuts down immediately |
| Cancel in web UI | Clean shutdown, cancel message to Claude |
| Submit in web UI | Clean shutdown, XML annotations to Claude |

## File Structure

```
canon/
├── commands/
│   └── canon.md              # Slash command definition
├── src/
│   ├── cli/
│   │   └── index.ts          # CLI entry point
│   ├── server/
│   │   ├── index.ts          # HTTP server + API routes
│   │   ├── git.ts            # Git operations
│   │   ├── files.ts          # File system operations
│   │   └── embedded-assets.ts # Auto-generated (DO NOT EDIT)
│   ├── shared/
│   │   └── types.ts          # Shared TypeScript interfaces
│   └── web/
│       ├── App.tsx           # Root component
│       ├── context/          # React Context providers
│       ├── components/       # UI components
│       ├── hooks/            # Custom React hooks
│       ├── utils/            # Utilities
│       └── styles/           # CSS
├── docs/
│   └── SPECS.md              # This file
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Development

```bash
# Development (HMR)
make dev

# Build binary
bun run build

# Install to ~/.local/bin
make install
```
