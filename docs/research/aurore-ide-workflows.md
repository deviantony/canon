# Aurore: Workflow & UX Requirements

**Date:** 2026-02-23
**Status:** Discovery / Pre-Design
**Related:** [Design Document](./aurore-ide-design.md) | [Technical Reference](./aurore-ide-technical-reference.md) | [POC Findings](./poc-findings.md)

---

## Core Thesis: Aurore as a Cognitive Debt Shield

Aurore is an **Agentic Development Interface (ADI)** — not an IDE. Aurore isn't where development happens — it's the interface through which you observe and direct it. Where IDEs are built around *writing* code, Aurore is built around *understanding, reviewing, and directing* AI-generated work. It is a **cognitive debt shield** that protects the developer's mental model of their software as AI assistants take over more of the implementation work.

### The Problem

As developers delegate coding to AI (Claude Code in this case), they gain velocity but lose understanding. This creates **cognitive debt** — the gap between the system's evolving structure and the developer's comprehension of how it works and why.

Key framing from the cognitive debt literature:

- "Technical debt lives in the code; cognitive debt lives in developers' minds." — Margaret-Anne Storey
- "Velocity can outpace understanding." — Storey, Cognitive Debt Revisited
- The goal is to "maintain a coherent mental model of what the system is doing and why"
- Documentation must be "living artifacts that teams actively engage with," not static files

### Aurore's Answer

Aurore provides four first-class surfaces — Documentation, Conversation, Validation, and Code — that together give the developer a complete, always-current view of their project. The annotation-first interaction model means the developer's engagement with each surface is active, not passive: they review, question, correct, and direct.

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
- Should support the equivalent of explanatory queries:
  - "Explain the release process"
  - "Explain the architecture"
  - "Show me the database schema relationships"
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
- Support for interactive Q&A replacement (see [Open Question: AskUserQuestion](#open-question-askuserquestion-replacement))

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

### Supporting Workflows

| Workflow | Current Tool | Aurore Surface |
|----------|-------------|---------------|
| UI/UX exploration | `/dev-design` (design-mode skill) | Conversation + Documentation |
| Codebase exploration | `/dev-research` | Conversation + Code |
| Quick questions | `/dev-q` | Conversation |
| Bug fixing | Direct Claude Code | Conversation + Code |
| Small features | `/dev-feature` | Conversation + Code |

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

## Home Screen: Project Dashboard

When Aurore launches, it opens to a **project dashboard** — not an empty workspace, not a conversation.

The dashboard provides orientation:
- Project name and key metrics (LOC, language breakdown, etc.)
- Architecture summary (rendered from docs)
- Active PRDs/plans and their status
- Recent changes (git log summary)
- Documentation health indicators (staleness, coverage)
- Prominent "Start Session" action

The dashboard draws from the Documentation pillar — it's essentially a curated view of the project's documentation surface, designed to give the developer a quick "where am I" before starting work.

---

## Git Integration

Aurore manages git operations as part of the workflow:
- Create commits (after review/validation)
- Create and switch branches
- Create pull requests (via `gh`)
- Show git status, diffs, and branch info (as current Canon does)

This reduces context-switching — the developer can go from review → commit → PR without leaving Aurore.

---

## Session Management

### Single Project

Aurore is bound to one working directory at a time. Switching projects means restarting Aurore pointed at a different directory. No multi-project dashboard.

### Multiple Sessions

Aurore can manage 1-3 concurrent Claude Code sessions within the same project. Each session appears as a tab with status indicators. The developer switches between sessions to review their conversation output.

### Session Lifecycle

Sessions are started explicitly (from the dashboard or via a prompt). They persist until ended or until Aurore shuts down. Aurore can resume previous Claude Code sessions via `--resume`.

---

## Open Questions

### AskUserQuestion Replacement

The `AskUserQuestion` tool is central to the developer's PRD and planning workflows. In Claude Code's terminal, it renders as structured prompts with options that the developer selects interactively. In Aurore, Claude runs as a subprocess — this tool's output arrives as stream-json events but cannot render natively.

**Preferred approach:** Instruct Claude (via `--append-system-prompt`) to use an Aurore-native structured format for interactive questions. Instead of calling `AskUserQuestion` (which targets the terminal), Claude outputs questions in a protocol that Aurore can parse from the assistant message stream and render as rich interactive widgets (radio buttons, checkboxes, text input, option cards). The developer's selections are composed into the next stdin prompt automatically.

This approach is preferred because:
- It doesn't depend on intercepting tool calls (which may not be feasible or reliable)
- It gives Aurore full control over the rendering and interaction design
- It can evolve independently of Claude Code's internal tool format
- It naturally extends to Aurore-specific interaction patterns (e.g., "annotate to answer" for nuanced responses)

**Other approaches to keep in mind:**
- Questions appearing as annotatable blocks (respond via annotation)
- Hybrid: rich widgets for simple structured questions, annotation for nuanced responses

**Status:** Needs design exploration for the protocol format and widget rendering. First priority for validation during the design exploration phase.

### Document Annotation UX

The Documentation surface needs annotation affordances optimized for markdown content, which differs from code:
- Code has line numbers and fixed-width structure → gutter-based annotation works well
- Markdown is flowing text with headings, lists, diagrams → annotation needs different anchoring

**Options to explore:**
- Heading-level annotation (annotate a section by its heading)
- Text selection annotation (highlight prose, attach comment)
- Block-level annotation (annotate a diagram, a table, a code block within markdown)
- Margin notes alongside rendered markdown

### Documentation Automation

How does Aurore keep documentation current?
- A dedicated sub-agent that runs after implementation phases to update affected docs
- Post-turn hooks that detect when code changes affect documented APIs/schemas
- A "documentation health" check that surfaces stale docs in the dashboard
- Manual trigger: developer annotates a doc section as "stale" and Aurore tasks Claude with updating it

### Validation Surface Design

Deferred for initial implementation, but the vision includes:
- Post-turn automated checks (tests, lints, type checking)
- Results rendered as annotatable findings
- Breakage detection (was passing, now failing)
- Pattern consistency and duplication detection
- Simplification opportunity surfacing

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

## Implementation Priority

### Phase 1: Foundation (Conversation + Code)
- Persistent server with WebSocket session management
- Conversation panel rendering stream-json output
- Conversation annotation (text selection, tool call targeting)
- Annotation submission composing prompts to Claude stdin
- Direct prompt input
- Integration with existing code/diff viewer and annotation system

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

### Phase 4: Validation Surface
- Post-turn automated validation framework
- Test/lint/type-check result rendering
- Breakage detection and surfacing
- Annotatable validation findings

### Phase 5: Documentation Automation
- Sub-agent for documentation maintenance
- Staleness detection and health indicators
- Architecture/schema doc auto-updates after implementation phases
