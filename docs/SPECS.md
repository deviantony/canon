# Canon - Code Review Tool for Claude Code

A browser-based code review tool that integrates with Claude Code sessions, enabling inline annotation during code review phases with feedback flowing directly back into the conversation.

## Problem Statement

**The review and feedback loop within Claude Code sessions is friction-heavy.**

When Claude makes changes, the review cycle breaks conversational flow. You're forced to context-switch - read diffs in one place, formulate feedback in another, then translate observations back to text. There's no way to directly annotate files during the review phase of AI-assisted development.

Even with a full IDE setup:
- Claude makes changes → you switch contexts to review (IDE diff, git diff, etc.)
- You spot issues → you switch back to describe them in text
- No direct "point at this line and say this" within the session flow

This friction accumulates across iterations and affects all Claude Code users:
- Container/remote users (most obvious - no IDE at all)
- Terminal-native users who prefer staying in flow
- Anyone who wants tighter feedback loops with Claude

## Solution

**Canon (`/canon`) initiates an annotation phase within your Claude Code session.**

When you invoke `/canon`:
1. You transition from "implementation mode" to "review mode" - same session, different focus
2. A local web UI opens presenting the changes for structured review
3. You annotate directly on the code (approve, request changes, comment)
4. Submitting returns annotations to the session as context
5. Claude continues with concrete, line-anchored feedback

```
┌─────────────────────────────────────────────────────┐
│  Claude Code Session                                │
│                                                     │
│  [Discussion] → [Implementation] → [/canon]         │
│        ↑                               ↓            │
│        │                        [Web UI Review]     │
│        │                               ↓            │
│        └──────── [Continue with annotations] ←──────┘
│                                                     │
└─────────────────────────────────────────────────────┘
```

The web UI is the annotation surface, but you never "leave" the session conceptually - you're in a review phase that feeds back into the conversation. The annotations become first-class input to the next turn, not copied/pasted observations.

## Use Cases

Canon isn't limited to reviewing Claude's changes. It's a general annotation tool for AI-assisted development:

| Use Case | Example |
|----------|---------|
| **Review changes** | Claude made edits → annotate what to fix or approve |
| **Guide refactoring** | Fresh session → annotate existing code → "refactor these areas" |
| **Provide context** | Point at specific lines → "when I say X, I mean this code" |
| **Request features** | Annotate where new code should go → "add validation here" |

`/canon` works with or without uncommitted changes. No changes? You're annotating the existing codebase.

## User Flow

### Flow A: Review After Implementation (typical)

```
[Claude makes changes] → /canon → [Annotate changes] → [Submit] → [Claude responds]
                                                                         ↓
                                                                   [Cycle repeats]
```

### Flow B: Fresh Session Annotation

```
[Fresh session] → /canon → [Annotate existing code] → [Submit] → [Claude acts on annotations]
```

### Detailed Steps

```
┌─────────────────────────────────────────────────────────────────┐
│ ANNOTATION PHASE (enter via /canon)                             │
├─────────────────────────────────────────────────────────────────┤
│ 1. User types `/canon` → enters annotation phase                │
│ 2. Browser opens with review UI (CLI blocks, awaiting input)    │
│ 3. User browses files (diff view if changes exist, or all files)│
│ 4. User adds margin annotations on specific lines               │
│ 5. User clicks "Submit Feedback" or "Cancel"                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACK TO CONVERSATION                                            │
├─────────────────────────────────────────────────────────────────┤
│ 6. Annotations (or cancel message) appear in session            │
│ 7. Claude responds to the line-anchored feedback                │
│ 8. Cycle repeats as needed                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Session Behavior

### Single Session Design

Canon binds to a fixed port (default 9847). Only one review session can be active at a time.

| Scenario | Behavior |
|----------|----------|
| `/canon` invoked while another session active | Fail fast with error message |
| Browser tab closed during review | Annotations lost, but can reopen URL while `/canon` still holds |
| User cancels `/canon` in Claude Code (Ctrl+C) | Server shuts down, URL no longer accessible, session ends abruptly |
| User clicks "Cancel" in web UI | Clean shutdown, sends cancel message to Claude |
| User clicks "Submit Feedback" | Clean shutdown, annotations sent to Claude |

### Cancel vs Submit

The web UI has two exit paths:

| Action | Output to Claude |
|--------|------------------|
| **Submit Feedback** | Markdown with all annotations (file, line, comment) |
| **Cancel Review** | `"User cancelled review. Ask what they'd like to do next."` |

Both cleanly shut down the server. Cancel gives Claude explicit direction rather than leaving it confused by empty output.

### Why Single Session?

- Simplicity: No session ID management or multi-tenant complexity
- Port predictability: Users can bookmark `localhost:9847`
- Clear mental model: One review phase at a time per Claude Code instance

### Recovery

If browser is accidentally closed:
1. URL remains accessible while `/canon` blocks
2. Reopen `localhost:9847` to continue annotating
3. All previous annotations are lost (no persistence in MVP)

If `/canon` is force-cancelled (Ctrl+C):
1. Server stops immediately
2. User can issue new commands or restart with `/canon`
3. Previous review context is gone (use Cancel button for clean exit)

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
│   1. Start HTTP server (Bun.serve)                          │
│   2. Open browser (or print URL for remote)                 │
│   3. await waitForDecision() ← Promise blocks here          │
│   4. Output feedback markdown to stdout                     │
└─────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│ HTTP Server              │  │ Browser UI                   │
│                          │  │                              │
│  GET  /api/files         │  │  ┌─────────┬───────────────┐ │
│  GET  /api/file/:path    │  │  │ File    │ Code viewer   │ │
│  GET  /api/diff          │◀─│  │ tree    │ (CodeMirror)  │ │
│  POST /api/feedback ─────│──│  │         │ [Margin notes]│ │
│       (resolves Promise) │  │  └─────────┴───────────────┘ │
│                          │  │         [Submit Feedback]    │
└──────────────────────────┘  └──────────────────────────────┘
```

## Tech Stack (Decided)

### Backend

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Runtime** | Bun | Fast, TypeScript native, compiles to single binary |
| **Server** | `Bun.serve()` | Built-in, no dependencies |
| **Distribution** | `bun build --compile` | Single binary, install via curl script |

### Frontend

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Framework** | React 18 + TypeScript | Stable, well-supported ecosystem |
| **Build** | Vite | Fast, embedded into binary at compile time |
| **Components** | shadcn/ui | Modern Notion-like aesthetic, accessible |
| **Styling** | Tailwind CSS | Dark mode only, utility-first |
| **Code Editor** | CodeMirror 6 | Lightweight, excellent gutter/margin annotation support |
| **Diff View** | `@codemirror/merge` | Native CodeMirror extension |
| **File Tree** | react-arborist | Modern, virtualized, Notion-like |

### Integration

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Claude Code** | Plugin with slash command | Standard distribution mechanism |
| **Invocation** | `!`canon`` backtick syntax | Captures stdout directly |
| **Feedback loop** | Promise-based blocking | Clean, no file polling |
| **Output** | Markdown to stdout | Claude can parse and respond |

## UI Design

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Canon                  [Diff ▼] [All Files]   [Cancel]  [Submit]   │
├──────────────────┬──────────────────────────────────────────────────┤
│                  │  src/components/Button.tsx              [Diff]   │
│  src/            │ ────────────────────────────────────────────────│
│    components/   │                                                  │
│      Button.tsx  │   1  import React from 'react'                   │
│    M Modal.tsx   │   2                                              │
│    A NewFile.tsx │   3  interface Props {          ┌──────────────┐ │
│  lib/            │   4    label: string      ←─────│ Consider     │ │
│    utils.ts      │   5  }                          │ adding type  │ │
│                  │   6                              │ for onClick  │ │
│                  │ + 7  export function Button() { └──────────────┘ │
│                  │ + 8    return <button />                         │
│                  │ + 9  }                                           │
│                  │                                                  │
└──────────────────┴──────────────────────────────────────────────────┘

Legend:
  M = Modified    A = Added    D = Deleted
  + = Added line  - = Removed line
  Margin notes appear to the right of annotated lines
```

### Key UX Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Annotation style** | Margin notes (right side) | Notion-inspired, doesn't interrupt code flow |
| **Theme** | Dark mode only | Simpler, matches typical dev environment |
| **View modes** | Diff view + Full file browsing | Can annotate changed files OR any related file |
| **File filtering** | Changed files / All files toggle | Quick access to what changed, but not limited |
| **Diff scope** | All uncommitted (staged + unstaged) | Single mode, no complexity |
| **Submit button** | Disabled when zero annotations | Forces intentional action; use Cancel for no feedback |
| **Non-code files** | "Preview not supported" message | No binary/image handling in MVP |

## Features

### MVP (Phase 1)

- [ ] CLI binary with Promise-based blocking server
- [ ] Slash command `/canon` plugin
- [ ] File tree with git status indicators (M/A/D)
- [ ] Toggle: changed files only vs all files
- [ ] CodeMirror 6 code viewer with syntax highlighting
- [ ] Diff view for changed files (`@codemirror/merge`)
- [ ] Full file view for any file (not just changed)
- [ ] Margin annotations (click line → add note, supports @file mentions)
- [ ] Submit button → markdown output to stdout
- [ ] Remote/container support (default port 9847, CANON_REMOTE=1 skips browser open)

### Phase 2

- [ ] Line range selection for annotations
- [ ] Annotation types/tags (question, suggestion, issue, note)
- [ ] Annotation persistence (localStorage or file-based)
- [ ] Keyboard shortcuts
- [ ] Search within file tree
- [ ] Collapse/expand all folders

### Phase 3

- [ ] Image file preview
- [ ] Binary file handling
- [ ] Session history (review previous sessions)
- [ ] Export annotations as standalone markdown
- [ ] Code suggestions (proposed replacement text)

## Technical Details

### Feedback Loop Mechanism

The CLI uses Promise-based blocking (learned from Plannotator):

```typescript
// CLI entry point
const server = await startServer({
  htmlContent: embeddedHtml,
});

// Blocks here until browser POSTs to /api/feedback
const result = await server.waitForDecision();

server.stop();

// Output captured by slash command
console.log(result.feedback);
process.exit(0);
```

```typescript
// Server implementation
const DEFAULT_PORT = 9847;

export async function startServer(options: ServerOptions): Promise<Server> {
  const port = process.env.CANON_PORT
    ? parseInt(process.env.CANON_PORT)
    : DEFAULT_PORT;
  const isRemote = process.env.CANON_REMOTE === '1';

  let resolveDecision: (result: FeedbackResult) => void;
  const decisionPromise = new Promise<FeedbackResult>((resolve) => {
    resolveDecision = resolve;
  });

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/api/feedback' && req.method === 'POST') {
        const body = await req.json();
        resolveDecision(body);  // Unblocks the CLI
        return Response.json({ ok: true });
      }

      // ... other routes
    },
  });

  // Auto-open browser unless in remote mode
  if (!isRemote) {
    openBrowser(`http://localhost:${port}`);
  }

  return {
    url: `http://localhost:${port}`,
    waitForDecision: () => decisionPromise,
    stop: () => server.stop(),
  };
}
```

### Data Structures

```typescript
interface ReviewSession {
  workingDirectory: string
  mode: 'diff' | 'all'  // View mode: changed files only, or all files
  annotations: Annotation[]
}

interface FileInfo {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'unchanged'
}

interface Annotation {
  id: string
  file: string
  lineStart: number
  lineEnd?: number
  comment: string  // Free-form text, supports @file/path mentions
}
```

### Output Format

When submitted, annotations are formatted as markdown:

```markdown
## Code Review Feedback

### src/components/Button.tsx

**Line 4:**
> Consider adding type for onClick prop

**Lines 12-15:**
> This logic seems duplicated from @src/lib/Modal.tsx - should we extract it?

### src/lib/utils.ts

**Line 42:**
> Why not use the existing `formatDate` helper instead of reimplementing?

---
*3 annotations across 2 files*
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files` | GET | List all files in project (tree structure) |
| `/api/files/changed` | GET | List only git-changed files with status |
| `/api/file/:path` | GET | Get file content |
| `/api/diff` | GET | Get all uncommitted changes (staged + unstaged) |
| `/api/feedback` | POST | Submit review (resolves blocking Promise) |

### Configuration

Environment variables:

```bash
CANON_PORT=9847        # Server port (default: 9847)
CANON_REMOTE=1         # Skip browser auto-open (for container/SSH setups)
```

## File Structure

```
canon/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── commands/
│   └── canon.md              # Slash command definition
├── src/
│   ├── cli/
│   │   └── index.ts          # CLI entry point
│   ├── server/
│   │   ├── index.ts          # Bun.serve server
│   │   ├── git.ts            # Git operations (diff, status)
│   │   └── files.ts          # File system operations
│   └── web/
│       ├── index.html
│       ├── main.tsx          # React entry
│       ├── App.tsx
│       ├── components/
│       │   ├── FileTree.tsx      # react-arborist based
│       │   ├── CodeViewer.tsx    # CodeMirror 6 based
│       │   ├── DiffViewer.tsx    # @codemirror/merge based
│       │   ├── MarginNote.tsx    # Annotation component
│       │   └── ui/               # shadcn/ui components
│       └── styles/
│           └── globals.css       # Tailwind + dark theme
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Slash Command

```markdown
---
description: Open interactive code review for current changes
allowed-tools: Bash(canon:*)
---

## Code Review Feedback

!`canon`

## Your Task

Address the code review feedback above. The user has reviewed your changes
and provided specific annotations and comments.
```

### Plugin Manifest

```json
{
  "name": "canon",
  "description": "Interactive code review with margin annotations",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  }
}
```

## Distribution

### Installation

Two-part installation (like Plannotator):

**1. Install CLI binary:**

```bash
# macOS / Linux
curl -fsSL https://example.com/canon/install.sh | bash

# This downloads the compiled Bun binary to ~/.local/bin/canon
```

**2. Install Claude Code plugin:**

```bash
# In Claude Code
/plugin install canon
```

### Building

```bash
# Build frontend (embedded into binary)
bun run build

# Compile to standalone binary
bun build --compile --target=bun-linux-x64 ./src/cli/index.ts --outfile=canon
bun build --compile --target=bun-darwin-arm64 ./src/cli/index.ts --outfile=canon-darwin-arm64
bun build --compile --target=bun-windows-x64 ./src/cli/index.ts --outfile=canon.exe
```

## Container/Remote Configuration

Running Claude Code in a container? Add port forwarding and set `CANON_REMOTE=1` to skip auto-opening browser:

```json
// devcontainer.json
{ "forwardPorts": [9847], "containerEnv": { "CANON_REMOTE": "1" } }
```

```bash
# Docker
docker run -p 9847:9847 -e CANON_REMOTE=1 ...
```

Then bookmark `http://localhost:9847` on your host.

## Research Summary

### Plannotator Analysis (Complete)

| Aspect | Plannotator Approach | Canon Approach |
|--------|---------------------|----------------|
| Feedback loop | Promise-based blocking | Same |
| Editor | @pierre/diffs (diff-only) | CodeMirror 6 (diff + full file) |
| Annotations | Inline (GitHub-style) | Margin notes (Notion-style) |
| Frontend | React 19 + Tailwind | React 18 + shadcn/ui + Tailwind |
| Backend | Bun.serve() | Same |
| Distribution | curl install + plugin | Same |

### Key Differentiators from Plannotator

1. **Full file browsing** - Not limited to diffs, can annotate any file
2. **Margin notes** - Notion-inspired side annotations vs inline
3. **Modern file tree** - react-arborist for better UX
4. **shadcn/ui** - Cleaner component library

## Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Multi-file annotations** | Simple @-mentions | User can type `@src/utils.ts` in annotation text, rendered as clickable link. No complex cross-linking. |
| **Annotation persistence** | No persistence | Stateless for MVP. Close browser = lose annotations. Can enhance later with localStorage or file-based sessions. |
| **Quick actions / templates** | No templates | Free-form text only. Keep it simple. Type field (question/suggestion/issue/note) provides enough structure. |

---

*Project: Canon*
*Status: Ready to Build*
*Last Updated: 2026-02-03*
