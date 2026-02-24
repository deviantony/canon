# Design Document: Aurore — Primary Development Context

**Date:** 2026-02-19
**Status:** Draft / Exploration
**Related:** [Technical Reference](./aurore-ide-technical-reference.md) | [Subscription Integration](./claude-subscription-integration.md)

---

## Vision

Invert Canon's relationship with Claude Code. Instead of Canon being an extension launched from Claude Code (`/canon:new`), Aurore becomes the primary development context — a browser-based workspace where Claude Code sessions run *inside* Aurore.

The core interaction model stays the same: **annotation-first development**. Users review code and conversation output, attach spatially-anchored feedback, and submit structured annotations that direct Claude's next actions. What changes is scope — annotations extend from code files to conversation output, and Aurore manages the full lifecycle of Claude Code sessions rather than being a one-shot review tool.

### What This Is Not

- Not a general-purpose IDE (no ambition to replace VS Code)
- Not a Claude Code reimplementation (uses the real CLI binary)
- Not an API proxy or token extraction tool

Aurore remains a **review and orchestration layer**. Code editing stays in Claude's hands (or the user's existing editor). Aurore shows code read-only, as Canon does today, and adds the ability to see, annotate, and direct Claude Code conversations.

---

## Current Architecture (Baseline)

### How Canon Works Today

```
Claude Code session
  └─ /canon:new (slash command)
       └─ Spawns: canon binary
            ├─ Starts HTTP server (port 9847)
            ├─ Opens browser automatically
            ├─ Blocks on waitForDecision() Promise
            ├─ User reviews code, adds annotations
            ├─ POST /api/feedback resolves the Promise
            ├─ Outputs XML to stdout
            └─ Exits
```

Key characteristics:
- **Ephemeral**: one-shot process, launches and exits per review
- **Unidirectional**: Canon outputs feedback XML, Claude Code consumes it
- **Code-only**: annotations target files and line ranges
- **No auth**: Canon never talks to an LLM — Claude Code does

### Current Code Organization

```
src/
├── cli/index.ts              # Entry point, Promise blocking
├── server/
│   ├── index.ts              # HTTP server, API routes, asset serving
│   ├── git.ts                # Git operations (diff, status, branch)
│   ├── files.ts              # File tree, gitignore parsing
│   └── embedded-assets.ts    # Auto-generated (DO NOT EDIT)
├── shared/types.ts           # Shared TypeScript interfaces
└── web/
    ├── App.tsx               # Root component
    ├── context/
    │   ├── AnnotationContext.tsx  # Annotation CRUD + XML formatting
    │   └── LayoutContext.tsx      # UI state (sidebar, selection)
    ├── components/           # React components (14 files)
    ├── hooks/                # useEditorInteraction, useInlineAnnotations
    ├── utils/                # Gutter, theme, inline annotations, keyboard, languages
    └── styles/globals.css    # Design tokens
```

### Current Annotation Model

Annotations today are code-only: each one targets a file and line range with a comment and a kind (action or question). The output is XML that Claude Code consumes as structured feedback.

The proposed model extends annotations to target three surfaces: code files, conversation messages, and tool calls. Each target carries the spatial context needed to anchor the annotation precisely. See [Technical Reference: Extended Annotation Model](./aurore-ide-technical-reference.md#typescript-interfaces) for the interface definitions and XML format.

---

## Proposed Architecture

### High-Level Overview

```
┌──────────────────────────────────────────────────────┐
│                   Browser (Aurore UI)                  │
│                                                       │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ File Tree│ │ Code / Diff  │ │  Conversation     │  │
│  │          │ │ Viewer       │ │  Panel            │  │
│  │          │ │ (CodeMirror) │ │  (annotatable)    │  │
│  │          │ │              │ │                    │  │
│  │          │ │ [existing]   │ │  [new]            │  │
│  └──────────┘ └──────────────┘ └──────────────────┘  │
│  ┌────────────────────────────────────────────────┐   │
│  │  Session Bar: [Session 1 ●] [Session 2 ○]     │   │
│  └────────────────────────────────────────────────┘   │
│                      WebSocket                        │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│                Aurore Server (Bun)                     │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │             Session Manager                     │  │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐    │  │
│  │  │ claude -p │ │ claude -p │ │ claude -p │    │  │
│  │  │ Session 1 │ │ Session 2 │ │ Session 3 │    │  │
│  │  │ (subprocess)│(subprocess)│(subprocess) │    │  │
│  │  └───────────┘ └───────────┘ └───────────┘    │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────┐  ┌───────────────────────────┐   │
│  │ File Watcher   │  │ Git / Files (existing)    │   │
│  └────────────────┘  └───────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

#### 1. CLI Subprocess, Not Agent SDK

Aurore spawns `claude -p` as child processes rather than using the Agent SDK.

**Why not the Agent SDK?** The SDK requires API key authentication and explicitly does not support Claude subscription billing (Pro/Max plans). Anthropic closed the request for subscription support as "NOT PLANNED." Since Aurore is designed around a developer's existing Claude Max subscription — not pay-per-token API billing — the SDK is not viable for the core experience.

The CLI subprocess approach means:

- **Auth flows through the real Claude Code binary** — Max subscription works via existing OAuth, no token extraction, no TOS issues
- **No API key required** — the entire experience runs on the user's existing subscription
- **Full Claude Code feature parity** — CLAUDE.md, skills, MCP servers, hooks all work because it *is* Claude Code
- **Structured I/O** via `stream-json` provides parseable messages

If Anthropic ever opens the SDK to subscription auth, migration from CLI subprocess to SDK would be straightforward — the message shapes are similar, and Aurore's rendering layer is format-agnostic.

See [Subscription Integration](./claude-subscription-integration.md) for the full auth analysis and [Technical Reference: Spawning Sessions](./aurore-ide-technical-reference.md#spawning-sessions) for implementation details.

#### 2. Persistent Server, Not One-Shot

Aurore becomes a long-running process. The current `waitForDecision()` → exit pattern is replaced with a persistent Bun server that:

- Stays alive across multiple review/annotation cycles
- Manages Claude Code session lifecycles
- Maintains WebSocket connections to the browser
- Watches the filesystem for changes

The existing one-shot `/canon:new` slash command and `waitForDecision()` pattern will be removed as part of the migration. Aurore becomes a persistent-only tool.

#### 3. WebSocket for Bidirectional Streaming

- **Server → Client**: Claude Code output (conversation messages, tool calls, results)
- **Client → Server**: User input (prompts, annotation submissions, session commands)
- Bun has native WebSocket support — no additional dependencies needed

#### 4. Annotation-First, Not Prompt-First

The primary interaction model is not a chat input box. It's:

1. Browse code or conversation output
2. Select content (lines, paragraphs, tool call blocks)
3. Attach annotations with spatial context
4. Submit — Aurore composes the structured prompt from your annotations

This is what Canon already does for code. The extension is applying it to conversation output.

---

## UX / UI Open Questions

This section tracks unresolved UX decisions that need answers before or during implementation. These will be refined through a dedicated UI exploration phase.

### Session Initiation
- How does a user start a new Claude Code session from Aurore? A button? A prompt input? Both?
- What's the default state when Aurore first opens — empty workspace waiting for user action, or a session auto-starts?
- Can you start a session from an annotation (annotate code first, then "start session with these annotations as the initial prompt")?

### Prompt vs Annotation Flow
- Can a user send a plain text prompt (like a terminal) in addition to annotation-composed prompts?
- If both are supported, how do they coexist in the UI? A text input at the bottom of the conversation panel?
- When submitting annotations, is there a preview/composition step, or does it go directly?

### Annotation Timing
- Can you annotate a conversation *while Claude is still responding* (mid-stream annotation)?
- If Claude is actively working, does "submit annotations" queue until the current turn completes, or interrupt?
- How do you annotate a conversation that hasn't started yet (pre-session code annotations)?

### Navigation Between Code and Conversation
- When Claude mentions a file or line number in conversation, can you click it to navigate to the code panel?
- When a tool_use block shows a file edit, can you click to see the diff in the code panel?
- How does the code panel know which file to show — user-driven selection only, or does it follow the conversation context?

### Session State Indicators
- What visual indicators show session state (idle, thinking, tool executing, waiting for input, errored, rate-limited)?
- How are rate limit pauses communicated?
- How does the user know when it's "their turn" to annotate/respond?

---

## Extended Annotation Model

### Current → Proposed

Today, annotations target code files only: a file path, line range, comment, and kind (action or question).

The proposed model introduces a **target union** with three surfaces:

- **Code** — same as today: file path + line range
- **Conversation** — targets a specific message within a session, optionally selecting a text range within the message body
- **Tool call** — targets a specific tool invocation by its ID

When submitted, conversation annotations get composed into the next prompt sent to the Claude Code session. The composition translates spatial annotations into natural language with context:

> "Correction on your earlier response: you said the API returns 403, but it actually returns 401. Also, regarding your edit to test-utils.ts — don't delete that file, it's needed by the test suite."

See [Technical Reference: TypeScript Interfaces](./aurore-ide-technical-reference.md#typescript-interfaces) for the interface definitions and XML output format.

---

## Feature Ideas

### Tier 1: Core (Minimum Viable)

**Conversation Panel**
Render Claude Code session output as structured, scrollable blocks. Each assistant message, tool call, and tool result is a distinct selectable region. Users can highlight text within a message and attach annotations, just like selecting lines in the code viewer.

**Annotation Across Both Panels**
Single annotation system spans code files and conversation output. The summary popover shows all annotations regardless of target type. Submit composes everything into a coherent prompt.

**Session Lifecycle**
Start a new Claude Code session from Aurore. Send prompts (composed from annotations or typed directly). See streaming output. Session persists until explicitly ended.

**Live File Change Detection**
When Claude Code edits a file, Aurore surfaces the diff in the code panel immediately — no manual refresh needed. The stream-json output includes structured tool results with file paths and diffs, which is a better data source than filesystem watching.

### Tier 2: Multi-Session

**Session Management**
Run 1-3 concurrent Claude Code sessions. Tab bar shows active sessions with status indicators. Switch between sessions to view their conversation and annotate their output.

**Cross-Session Awareness**
When multiple sessions touch the same file, Aurore surfaces the conflict. Annotations can reference what another session did: "Session 1 already refactored this — coordinate."

### Tier 3: Advanced Interaction

**Annotation-Driven Prompting**
Skip the text input entirely. Browse code → annotate → submit. Aurore composes the prompt. This is already what Canon's `/canon:new` does, elevated to the primary interaction model.

**Tool Call Review**
Tool calls are structurally different from text messages — they have a clear action, a result, and reversibility context. Aurore renders each tool call as a rich, annotatable block rather than opaque text: file edits show inline diffs, Bash commands show exit codes, Write calls show the created content.

Annotating a tool call anchors to the specific `toolUseId`, not a text selection. This enables precise correction workflows:
- **Post-hoc correction**: "This edit was wrong — the import should be from `./utils` not `../utils`." Aurore composes the annotation with the tool call context so Claude knows exactly which edit to revisit.
- **Undo request**: Annotate a destructive action with "Revert this." The stream-json output includes `tool_use_result.originalFile` and `structuredPatch`, so Aurore can show what was lost and compose a revert prompt.
- **Cross-panel linking**: Click a tool call that edited `auth.ts` and the code panel jumps to the file, highlighting the changed lines. Annotate either surface — the tool call in the conversation or the lines in the code panel — and Aurore understands they're related.

Future possibility: if Aurore ever moves to the Agent SDK path, tool calls could be intercepted *before* execution for approval/modification. Under the current CLI subprocess model, review is post-hoc only.

**Session Timeline**
Visual timeline per session showing: messages, tool calls, file edits, commits. Click any point to see state at that moment. Set manual checkpoints. Annotate the divergence point when things go off track.

**Session Forking**
See a conversation going well until turn 5? Fork it. Claude Code supports session resumption and forking; Aurore could create branching conversation paths. See [Technical Reference: Discovered Flags](./aurore-ide-technical-reference.md#discovered-flags-useful-for-aurore) for the relevant CLI flags.

**Prompt Composition Workspace**
Dedicated panel where annotations from code, conversation, and cross-session sources are assembled into a preview of the prompt before sending. Reorder, edit, review.

---

## UI Layout Concepts

### Default Layout (Single Session)

```
┌────────────────────────────────────────────────────────────┐
│  Aurore                             [Submit] [Cancel]  [⌘K]│
├──────────┬─────────────────────┬───────────────────────────┤
│          │                     │                           │
│  File    │  Code / Diff        │  Conversation             │
│  Tree    │  Viewer             │  Panel                    │
│          │                     │                           │
│  [Changes│  (existing          │  ┌─── assistant ────────┐ │
│   / All] │   CodeMirror)       │  │ "I'll fix the bug   │ │
│          │                     │  │  in auth.ts..."      │ │
│          │                     │  └──────────────────────┘ │
│          │                     │  ┌─── tool_use ─────────┐ │
│          │                     │  │ Edit: src/auth.ts    │ │
│          │                     │  │ lines 40-45          │ │
│          │                     │  └──────────────────────┘ │
│          │                     │  ┌─── tool_result ──────┐ │
│          │                     │  │ ✓ Applied            │ │
│          │                     │  └──────────────────────┘ │
│          │                     │                           │
│          │                     │  [Annotation input...]    │
│          │                     │                           │
├──────────┴─────────────────────┴───────────────────────────┤
│  [Session 1 ●]  [Session 2 ○]  [+ New Session]            │
└────────────────────────────────────────────────────────────┘
```

### Flexible Panels

The three-panel layout (file tree, code, conversation) should be resizable and rearrangeable. Users might want:
- Conversation full-width (no code panel) when reviewing Claude's reasoning
- Code full-width (no conversation) when doing traditional code review
- Side-by-side when annotating both simultaneously

The existing `LayoutContext` already manages sidebar width and visibility — extend it for the conversation panel.

---

## Migration Path

### Removal of Legacy Slash Command Architecture

The transition to Aurore replaces the current one-shot model entirely. The following will be removed:

- **`/canon:new` and `/canon:setup` slash commands** — Aurore is no longer invoked from within Claude Code
- **`waitForDecision()` Promise pattern** — no more blocking on a single feedback submission
- **XML-to-stdout output** — feedback flows directly into managed Claude Code sessions, not via stdout
- **`src/cli/index.ts` entry point** — replaced by a persistent server entry point
- **`/api/feedback` endpoint** — replaced by WebSocket-based annotation submission

### What Stays

- **All existing UI components** — FileTree, CodeViewer, DiffViewer, annotation system, sidebar, etc.
- **Git operations** (`src/server/git.ts`) — still needed for diff/status
- **File operations** (`src/server/files.ts`) — still needed for file tree
- **Design system** — CSS variables, dark theme, warm minimalism aesthetic
- **CodeMirror integration** — code/diff viewing remains the same

### Phased Implementation

**Phase 0: Proof of Concept**
- Minimal end-to-end validation of the core architecture
- Bun server spawns `claude -p` as a subprocess with stream-json I/O
- WebSocket relays stream-json messages to a bare-bones browser page
- Render raw conversation messages (no styling, no annotation yet)
- Validate: subprocess lifecycle, stream parsing, WebSocket relay, session resumption
- **Goal**: confirm the plumbing works before investing in UI

**Phase 1: Persistent Server + Conversation View**
- Aurore becomes long-running (persistent mode is the default, no flag needed)
- Integrate conversation rendering into the existing Aurore UI alongside code/diff panels
- New `ConversationPanel` component renders structured messages with Aurore's design language
- Annotations extend to conversation blocks
- "Submit annotations" composes prompt and pipes to session stdin

**Phase 2: Multi-Session + File Watching**
- `SessionManager` for 2-3 concurrent sessions
- Session tab bar in UI
- File system watcher detects changes from any session
- Cross-session annotation references

**Phase 3: Rich Interaction**
- Tool call surfacing and review
- Session timeline with checkpoints
- Prompt composition workspace
- Session forking

---

## Authentication Model

Aurore delegates all authentication to the Claude Code binary. The developer's existing `claude login` session is used — Aurore never touches tokens or credentials.

### Policy Context

Anthropic's [legal and compliance page](https://code.claude.com/docs/en/legal-and-compliance) (updated 2026-02-20) states that OAuth authentication on Free/Pro/Max plans is "intended exclusively for Claude Code and Claude.ai" and that developers building products should use API key authentication. The policy explicitly prohibits the Agent SDK with subscription OAuth but does not specifically address CLI subprocess spawning.

Aurore is a personal development tool, not a published product. It spawns the real `claude` binary — the actual Claude Code process handles OAuth internally. Aurore never extracts, stores, or proxies tokens. If Aurore were ever distributed to others, the auth model would need to be revisited — likely requiring API key support or an official agreement with Anthropic.

See [Subscription Integration](./claude-subscription-integration.md) for the full policy analysis including the January 2026 enforcement history.

---

## Differentiation

| Tool | Primary Model | Aurore |
|------|--------------|--------|
| VS Code + Claude extension | IDE-first, Claude is a sidebar | |
| Claude.ai web | Conversation-first, no code editing | |
| Claude Code CLI | Terminal-first, text I/O | |
| Cursor / Windsurf | IDE-first, AI as autocomplete/chat | |
| **Aurore** | **Annotation-first**: review + directed feedback | **This** |

The fundamental insight: **annotation is a superior interaction model for AI-assisted development.** Instead of typing natural language prompts, you:

1. See the code or conversation output
2. Select the specific part you want to address
3. Attach precise, spatially-anchored feedback

This is the difference between writing a paragraph in chat vs. leaving inline comments on a PR. The inline comments are always better because they carry contextual information for free.

---

## Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `stream-json` format changes between Claude Code versions | Breaks message parsing | Version detection via `init` message's `claude_code_version` field |
| Anthropic restricts `claude -p` subprocess spawning | Core architecture blocked | Fall back to Agent SDK + API key; monitor policy signals |
| Scope creep toward full IDE | Never ships | Phase 1 is deliberately minimal — conversation panel + single session |

See [Technical Reference](./aurore-ide-technical-reference.md) for implementation-level mitigations (WebSocket reconnection, stream-json error detection).
