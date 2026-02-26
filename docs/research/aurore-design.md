# Aurore: Design Document

**Date:** 2026-02-24
**Status:** Authoritative
**Related:** [Technical Reference](./aurore-ide-technical-reference.md) | [Subscription Integration](./claude-subscription-integration.md) | [POC Findings](./poc-findings.md)

---

## Vision & Thesis

### Aurore as a Cognitive Debt Shield

Aurore is an **Agentic Development Interface (ADI)** — not an IDE. It isn't where development happens — it's the interface through which you observe and direct it. Where IDEs are built around *writing* code, Aurore is built around *understanding, reviewing, and directing* AI-generated work.

As developers delegate coding to AI (Claude Code in this case), they gain velocity but lose understanding. This creates **cognitive debt** — the gap between the system's evolving structure and the developer's comprehension of how it works and why.

Key framing from the cognitive debt literature:

- "Technical debt lives in the code; cognitive debt lives in developers' minds." — Margaret-Anne Storey
- "Velocity can outpace understanding." — Storey, Cognitive Debt Revisited
- The goal is to "maintain a coherent mental model of what the system is doing and why"
- Documentation must be "living artifacts that teams actively engage with," not static files

Aurore provides four first-class surfaces — Documentation, Conversation, Validation, and Code — that together give the developer a complete, always-current view of their project. The annotation-first interaction model means the developer's engagement with each surface is active, not passive: they review, question, correct, and direct.

### What Aurore Is

Invert Canon's relationship with Claude Code. Instead of Canon being an extension launched from Claude Code (`/canon:new`), Aurore becomes the primary development context — a browser-based workspace where Claude Code sessions run *inside* Aurore.

The core interaction model stays the same: **annotation-first development**. Users review code and conversation output, attach spatially-anchored feedback, and submit structured annotations that direct Claude's next actions. What changes is scope — annotations extend from code files to conversation output, and Aurore manages the full lifecycle of Claude Code sessions rather than being a one-shot review tool.

### What Aurore Is Not

- Not a general-purpose IDE (no ambition to replace VS Code)
- Not a Claude Code reimplementation (uses the real CLI binary)
- Not an API proxy or token extraction tool

Aurore remains a **review and orchestration layer**. Code editing stays in Claude's hands (or the user's existing editor). Aurore shows code read-only, as Canon does today, and adds the ability to see, annotate, and direct Claude Code conversations.

### References

- [Simon Willison — Cognitive Debt (2026-02-15)](https://simonwillison.net/2026/Feb/15/cognitive-debt/)
- [Margaret-Anne Storey — Cognitive Debt (2026-02-09)](https://margaretstorey.com/blog/2026/02/09/cognitive-debt/)
- [Margaret-Anne Storey — Cognitive Debt Revisited (2026-02-18)](https://margaretstorey.com/blog/2026/02/18/cognitive-debt-revisited/)

---

## The Four Pillars

Aurore organizes around four surfaces, ordered by importance:

### 1. Documentation (Primary)

**Purpose:** Maintain the developer's mental model. Surface architecture, decisions, progress, and rationale. Protect against cognitive debt.

**What it covers:**
- Architecture documentation
- API specifications
- Database schema documentation
- Development guidelines and conventions
- PRDs (Product Requirements Documents)
- Implementation plans
- Project metrics (LOC counts via tools like [scc](https://github.com/boyter/scc))

**Key characteristics:**
- Docs live in the project repo (`docs/`, `.claude/plans/`, etc.) — Aurore renders them with rich formatting
- Markdown-first with diagram support (Mermaid via [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) or alternatives)
- Annotatable — same annotation model as code, but optimized for markdown content
- Should support explanatory queries: "Explain the release process," "Show me the database schema relationships"
- Automation to keep docs current (potentially via a documentation-maintenance sub-agent)
- Project state dashboard: metrics, recent changes, active plans, doc staleness indicators

**Why it's #1:** As AI does more coding, the developer's primary value shifts from writing code to understanding and directing the system. Documentation is the medium for that understanding. Without it, the developer becomes a prompt typist who can't evaluate whether the AI's output is correct.

### 2. Conversation (Secondary)

**Purpose:** Interface with Claude Code sessions. Send prompts, review output, annotate responses.

**Key characteristics:**
- Linear, chronological flow — no branching UI, one continuous stream
- Speed matters — rendering should feel fast, no janky streaming
- Better information density than terminal through web UI affordances (rich tool call rendering, inline diffs, collapsible sections)
- Tool calls rendered in summarized form (tool name + target + result status), expandable for details
- Sub-agent activity appears as collapsed nested blocks — "Agent `backend-dev` spawned... completed" — without showing full agent output
- Annotatable — select text in assistant messages, annotate tool calls by ID
- Prompt input for sending direct prompts (in addition to annotation-composed prompts)
- Support for interactive Q&A replacement (see [Open Question: AskUserQuestion](#1-askuserquestion-replacement))

### 3. Validation (Future / Deferred)

**Purpose:** Automated quality gates that run after Claude makes changes, with results surfaced for review.

**Key characteristics:**
- Post-turn validation: after each Claude turn completes, configured checks run automatically
- Covers: tests, type checking, linting (language + custom), pattern consistency, duplication detection, simplification opportunities
- Results surfaced as a reviewable surface — not just pass/fail but annotatable findings
- Automatically surfaces breakage ("this test was passing before, now it fails")

**Status:** This pillar is acknowledged as important but **deferred** for initial implementation. The workflow exists today as manual commands (`/dev-review`, sub-agents for best practices review) and will be formalized later.

### 4. Code (Foundational)

**Purpose:** Browse, read, and annotate code. Review diffs. Traditional code review.

**Key characteristics:**
- Same as current Canon: file tree, CodeMirror viewer, diff view, inline annotations
- Read-only — Aurore never edits code, Claude does
- Diffs surfaced automatically when Claude edits files (via stream-json `tool_use_result`)
- Least important in terms of the developer's time allocation — most code interaction happens through Conversation and Documentation
- Still essential for targeted review, annotation, and when the developer wants to understand specific implementation details

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────┐
│               Browser (Aurore UI)                │
│                                                  │
│  See docs/explorations/aurore-ui-prototype.html  │
│  for the validated UI layout and interactions.   │
│                                                  │
│                   WebSocket                      │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│              Aurore Server (Bun)                  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │           Session Manager                    │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ │ │
│  │  │ claude -p │ │ claude -p │ │ claude -p │ │ │
│  │  │ Session 1 │ │ Session 2 │ │ Session 3 │ │ │
│  │  │(subprocess)│(subprocess)│(subprocess) │ │ │
│  │  └───────────┘ └───────────┘ └───────────┘ │ │
│  └─────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ File Watcher │  │ Git / Files (existing)  │   │
│  └──────────────┘  └─────────────────────────┘   │
└───────────────────────────────────────────────────┘
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

## Interaction Model

### Annotation-First, Prompt-Capable

The primary interaction model is annotation: select content on any surface, attach feedback, submit. But direct prompting is also supported for situations where annotation isn't the right fit (starting a new session, asking questions, giving open-ended instructions).

### Two Annotation Modes

1. **Quick submit**: Annotate something → submit inline. The annotation is composed into a prompt and sent immediately. Good for simple corrections and quick feedback.

2. **Compose and review**: Accumulate annotations across multiple surfaces (code, docs, conversation). Preview the composed prompt. Edit if needed. Send when ready. Good for complex multi-surface feedback, phase reviews, or when the developer wants to carefully craft the next instruction.

### Workflow Pacing

- **Passive monitoring**: The developer does NOT watch Claude work in real-time. Claude runs, the developer checks back when the turn completes (or is notified).
- **No mid-stream annotation**: The developer waits for Claude to finish a turn before reviewing and annotating. Mid-stream interruption is not a priority.
- **Distinct review step**: Moving from "Claude is implementing" to "I'm reviewing" is a conscious transition, not a continuous activity. Aurore should make this transition smooth but intentional.

### Mode Fluidity

Aurore has **no explicit modes**. The UI does not switch between "PRD Mode," "Implementation Mode," or "Review Mode." The four surfaces are always available. The workflow phase is implicit based on what the developer is doing:

- Writing a PRD → heavy use of Conversation + Documentation surfaces
- Reviewing code → heavy use of Code + Conversation surfaces
- Planning → Conversation + Documentation
- Quick question → Conversation only

The UI may adapt subtly (e.g., auto-navigating to a file Claude just edited, highlighting new documentation changes), but the layout remains constant.

---

## Current Workflow Map

The developer's existing workflow is highly automated via Claude Code commands, agents, and skills. Aurore should absorb and enhance this flow, not replace it.

### The Full Development Lifecycle

```
Phase                  Current Tool              Aurore Surface
─────────────────────────────────────────────────────────────────────

1. PRD Creation        /dev-prd                  Conversation + Documentation
   Discussion          (AskUserQuestion)         (Q&A in conversation,
   Q&A refinement                                 PRD rendered in docs)
   Document output

2. Implementation      /dev-plan                 Conversation + Documentation
   Planning            (EnterPlanMode)           (plan discussion in conversation,
   Plan review         Plannotator (hook)         plan annotation in docs surface)
   Plan approval

3. Implementation      /dev-impl                 Conversation + Code
   Phase execution     (backend-dev/             (watch progress in conversation,
   Agent-driven work    frontend-dev agents)      review code changes)
   Skill invocations

4. Code Review         /canon:new                Code + Conversation
   Diff inspection     (current Canon)           (annotate diffs and code,
   Annotations                                    annotations compose prompts)
   Feedback loop

5. Automated Review    /dev-review               Validation (future)
   Best practices      (sub-agents)              (automated checks surface
   Pattern checks                                 findings for review)
   Simplification

6. Commit & PR         Manual / Claude Code      Aurore manages git
   Git operations      (git commands)            (commit, branch, PR
   PR creation                                    from within Aurore)

7. PR Review Response  /dev-code-review          Conversation + Code
   Address feedback    (gh + agents)             (review comments surfaced,
   Iterate                                        respond via annotations)
```

### Architecture: Commands → Agents → Skills

The developer's Claude Code setup uses a three-layer architecture for context efficiency:

```
Commands (entry points, ~50 lines each)
  │  Minimal orchestration logic
  │  Load only when user invokes
  ▼
Agents (domain experts, ~150 lines each)
  │  backend-dev: Go, PostgreSQL, OpenAPI
  │  frontend-dev: React, TypeScript, Design System
  │  Run in isolated context windows
  ▼
Skills (portable expertise, ~120 lines each)
  │  db-review, api-patterns, design-system, design-mode
  │  Invoked by agents during work
  │  Reference code as source of truth
```

**Implication for Aurore:** Aurore doesn't need to replicate this architecture. Claude Code sessions managed by Aurore already have full access to commands, agents, and skills. Aurore's job is to surface the session's activity (conversation stream) and provide annotation/review capabilities on top. The agents appear as collapsed nested blocks in the conversation — the developer sees "Agent `backend-dev` spawned... completed" without needing to see the full agent context.

### Supporting Workflows

| Workflow | Current Tool | Aurore Surface |
|----------|-------------|---------------|
| UI/UX exploration | `/dev-design` (design-mode skill) | Conversation + Documentation |
| Codebase exploration | `/dev-research` | Conversation + Code |
| Quick questions | `/dev-q` | Conversation |
| Bug fixing | Direct Claude Code | Conversation + Code |
| Small features | `/dev-feature` | Conversation + Code |

---

## Extended Annotation Model

### Current → Proposed

Today, annotations target code files only: a file path, line range, comment, and kind (action or question).

The proposed model introduces a **target union** — each annotation anchors to one of four content types:

- **Code** — file path + line range (same as today)
- **Conversation** — a specific message within a session, optionally selecting a text range within the message body
- **Tool call** — a specific tool invocation by its ID
- **Document** — a section, text selection, or block within a markdown document

When submitted, conversation annotations get composed into the next prompt sent to the Claude Code session. The composition translates spatial annotations into natural language with context:

> "Correction on your earlier response: you said the API returns 403, but it actually returns 401. Also, regarding your edit to test-utils.ts — don't delete that file, it's needed by the test suite."

See [Technical Reference: TypeScript Interfaces](./aurore-ide-technical-reference.md#typescript-interfaces) for the interface definitions and XML output format.

---

## UI Layout

The UI layout, panel arrangement, session management, and home screen design are validated in the interactive prototype:

**Reference:** `docs/explorations/aurore-ui-prototype.html`

The prototype defines the authoritative layout including flexible panels (resizable, rearrangeable), session bar with status dots, and project dashboard home screen. Implementation should match the prototype's visual design and interaction patterns.

---

## Feature Tiers

### Tier 1: Core (Minimum Viable)

**Conversation Surface**
Render Claude Code session output as structured, scrollable blocks. Each assistant message, tool call, and tool result is a distinct selectable region. Users can highlight text within a message and attach annotations, just like selecting lines in the code viewer.

**Unified Annotation System**
Single annotation system spans all four surfaces — Code, Conversation, Documentation, and Validation findings. The summary popover shows all annotations regardless of content type. Submit composes everything into a coherent prompt.

**Session Lifecycle**
Start a new Claude Code session from Aurore. Send prompts (composed from annotations or typed directly). See streaming output. Session persists until explicitly ended.

**Code Surface**
Existing Canon code/diff viewer integrated into the persistent Aurore layout. Live file change detection — when Claude edits a file, the diff surfaces immediately via stream-json `tool_use_result` data (better than filesystem watching).

### Tier 2: Multi-Session

**Session Management**
Run 1-3 concurrent Claude Code sessions. Tab bar shows active sessions with status indicators. Switch between sessions to view their conversation and annotate their output.

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
See a conversation going well until turn 5? Fork it. Claude Code supports session resumption and forking; Aurore could create branching conversation paths. See [Technical Reference: Discovered Flags](./aurore-ide-technical-reference.md#discovered-flags--edge-cases) for the relevant CLI flags.

**Prompt Composition Workspace**
Dedicated panel where annotations from code, conversation, and cross-session sources are assembled into a preview of the prompt before sending. Reorder, edit, review.

---

## Implementation Phases

*Authoritative — supersedes earlier phasing from both source documents.*

### Phase 1: Foundation (Conversation + Code) ✓
- Persistent server with WebSocket session management
- Conversation panel rendering stream-json output (streaming via stream_event deltas)
- Annotation submission composing prompts to Claude stdin
- Direct prompt input
- Integration with existing code/diff viewer and annotation system
- Markdown rendering in assistant messages (react-markdown + remark-gfm)
- Compact tool call display with status transitions (Running → Done)
- Structured annotation feedback display (parsed XML → Review cards)

### Phase 1.5: Conversation Annotation + Session Controls
- Conversation surface text selection (select text in assistant messages)
- Tool call targeting (annotate specific tool uses/results)
- Annotation creation from conversation (reuse existing annotation model)
- Design exploration for conversation annotation UX (selection affordances, inline vs sidebar)
- Annotation overlay integration (conversation annotations appear alongside code annotations)
- Context usage indicator (session context window consumption %)
- Force stop in-progress session (send interrupt to Claude subprocess)

### Phase 2: Documentation Surface
- Markdown rendering with Mermaid diagram support
- Document browsing (file tree filtered to docs)
- Document annotation (section-level, text selection, block-level)
- Project dashboard as home screen
- Basic project metrics (LOC via scc or similar)

### Phase 3: Git + Session Management
- Git operations from Aurore (commit, branch, PR)
- Multi-session support (2-3 concurrent sessions with tab bar)
- Session resume/fork capabilities
- Create new sessions from within Aurore (project selector, initial prompt)
- Stop and remove existing sessions (cleanup subprocess, clear session state)

### Phase 4: Command Palette
- Command palette overlay (keyboard-triggered, fuzzy search)
- Navigation across surfaces (jump to file, doc, session)
- Focus mode toggle (expand active panel to full width)
- Annotation review (list, filter, navigate pending annotations)
- Session switching (quick-switch between active sessions)

### Phase 5: Validation Surface
- Post-turn automated validation framework
- Test/lint/type-check result rendering
- Breakage detection and surfacing
- Annotatable validation findings

### Phase 6: Documentation Automation
- Sub-agent for documentation maintenance
- Staleness detection and health indicators
- Architecture/schema doc auto-updates after implementation phases

### Phase 7: Canon Cleanup
- Remove `/canon:new` and `/canon:setup` slash commands
- Remove `waitForDecision()` Promise pattern and `/api/feedback` endpoint
- Remove `src/cli/index.ts` one-shot entry point
- Remove XML-to-stdout output path
- Remove `CANON_PORT` / `CANON_REMOTE` env vars (replaced by `AURORE_PORT`)
- Rename remaining Canon references in code, config, and package metadata to Aurore
- Update CLAUDE.md and README to reflect Aurore-only usage

---

## Migration Path

### What Gets Removed

The transition to Aurore replaces the current one-shot model entirely:

- **`/canon:new` and `/canon:setup` slash commands** — Aurore is no longer invoked from within Claude Code
- **`waitForDecision()` Promise pattern** — no more blocking on a single feedback submission
- **XML-to-stdout output** — feedback flows directly into managed Claude Code sessions, not via stdout
- **`src/cli/index.ts` entry point** — replaced by a persistent server entry point
- **`/api/feedback` endpoint** — replaced by WebSocket-based annotation submission

### What Stays

- **All existing UI components** — FileTree, CodeViewer, DiffViewer, annotation system, sidebar, etc. Components present in the UI prototype should match its styling; components not in the prototype keep their Canon design.
- **Git operations** (`src/server/git.ts`) — still needed for diff/status
- **File operations** (`src/server/files.ts`) — still needed for file tree
- **Design system** — CSS variables, dark theme, warm minimalism aesthetic
- **CodeMirror integration** — code/diff viewing remains the same

---

## Ports

| Port | Use |
|------|-----|
| **9847** | Aurore server (HTTP + WebSocket). Configurable via `AURORE_PORT` env var. |
| **6443** | Vite dev server (HMR). Dev-only, not used in production binary. |

---

## Authentication Model

Aurore delegates all authentication to the Claude Code binary. The developer's existing `claude login` session is used — Aurore never touches tokens or credentials.

### Policy Context

Anthropic's [legal and compliance page](https://code.claude.com/docs/en/legal-and-compliance) (updated 2026-02-20) states that OAuth authentication on Free/Pro/Max plans is "intended exclusively for Claude Code and Claude.ai" and that developers building products should use API key authentication. The policy explicitly prohibits the Agent SDK with subscription OAuth but does not specifically address CLI subprocess spawning.

Aurore is a personal development tool, not a published product. It spawns the real `claude` binary — the actual Claude Code process handles OAuth internally. Aurore never extracts, stores, or proxies tokens. If Aurore were ever distributed to others, the auth model would need to be revisited — likely requiring API key support or an official agreement with Anthropic.

See [Subscription Integration](./claude-subscription-integration.md) for the full policy analysis including the January 2026 enforcement history.

---

## Design Constraints

### Preserve the Editorial Identity

Aurore's "warm minimalism" / editorial design language carries forward:
- Dark theme with gold accents
- Geist for UI, JetBrains Mono for code
- Gold gradient corner glow on interactive cards
- Subtle, responsive animations
- Generous typography with editorial spacing

The four new surfaces must feel like natural extensions of this design, not bolted-on additions.

### Technical Constraints (from POC)

- CLI subprocess architecture (not Agent SDK) — uses `claude -p` with stream-json I/O
- WebSocket for bidirectional streaming between server and browser
- Bun runtime for server (native WebSocket support, fast binary compilation)
- Single-page React application with Vite build
- No new runtime dependencies unless strictly necessary

### Philosophical Constraints

- **Aurore never edits code** — Claude does. Aurore is a review and orchestration layer.
- **Annotation-first** — the primary interaction is spatial, contextual feedback, not chat.
- **Cognitive debt shield** — every UX decision should be evaluated against: "does this help the developer maintain their mental model?"
- **Personal tool** — designed for one developer, not teams. No multi-user features.

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

---

## Open Questions

### 1. AskUserQuestion Replacement
**Status:** Unresolved — needs design exploration
**Blocks:** Phase 1 (Conversation surface)
**Summary:** Claude's `AskUserQuestion` tool targets the terminal. In subprocess
mode, Aurore must intercept or replace this. Preferred approach: `--append-system-prompt`
with a custom protocol format that Aurore parses from the assistant message stream
and renders as interactive widgets (radio buttons, option cards, text input).
**Design space:** Protocol format, widget rendering, fallback for unstructured questions,
hybrid approach (widgets for structured, annotation for nuanced).

### 2. Conversation Annotation UX
**Status:** Unresolved — needs design exploration
**Blocks:** Phase 1 (Conversation surface)
**Summary:** The data model exists (target union with conversation/tool-call types)
but the visual design is undefined. The annotation experience should be consistent
with code annotation — same visual language, same interaction patterns (select, annotate,
review). How does text selection work in flowing conversation text? How are tool call
annotations rendered differently? What does the annotation popover look like anchored
to a conversation block vs a code line?
**Design space:** Adapting the code annotation design (gutter markers, inline cards,
popover) to conversation content. Selection mechanics, popover positioning,
tool-call-specific affordances. Goal: a developer who knows code annotation should
instantly understand conversation annotation.

### 3. Document Annotation UX
**Status:** Unresolved — needs design exploration
**Blocks:** Phase 2 (Documentation surface)
**Summary:** Markdown content differs from code — flowing text, headings, lists, diagrams.
But from an annotation perspective, a code file and a document file are both documents.
The annotation experience should be as similar as possible: same visual language,
same interaction flow (select content, attach feedback, review in summary).
Differences should be in anchoring mechanics, not in the annotation UX itself.
**Design space:** Adapting code annotation patterns to markdown — heading-level
anchoring, text selection, block-level annotation (diagrams, tables, code blocks
within markdown), margin notes. Goal: consistent annotation experience across all
content types.

### 4. Notification / Background Activity
**Status:** Unresolved — needs design exploration
**Blocks:** Phase 1 (passive monitoring workflow)
**Summary:** Passive monitoring means developers don't watch Claude work in real-time —
they check back when turns complete. The primary status mechanism is **session dots**
from the UI prototype (pulsing = processing, solid = ready). What needs design is
extending beyond visual dot state: how does the developer know to come back when
they've switched to another app or tab?
**Design space:** Browser notifications, sound cues, badge/favicon updates,
"your turn" indicator, error/rate-limit alerts. Session dots remain the core
in-app indicator; these extensions cover the out-of-focus case.
