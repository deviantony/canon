# Technical Reference: Aurore CLI Integration

**Date:** 2026-02-19
**Status:** Validated
**Related:** [Design Document](./aurore-ide-design.md) | [Subscription Integration](./claude-subscription-integration.md)

This document contains validated CLI behavior, stream-JSON schemas, TypeScript interfaces, and code snippets for the Aurore architecture. For vision, architecture decisions, and UX design, see the [design document](./aurore-ide-design.md).

---

## Table of Contents

- [CLI Flags Reference](#cli-flags-reference)
- [Spawning Sessions](#spawning-sessions)
- [Stream-JSON Output Format](#stream-json-output-format)
- [Sending Input (stdin)](#sending-input-stdin)
- [TypeScript Interfaces](#typescript-interfaces)
- [Validation Log](#validation-log)
- [Discovered Flags & Edge Cases](#discovered-flags--edge-cases)

---

## CLI Flags Reference

All flags validated against `claude --help` and live testing (Claude Code v2.1.47).

### Core Session Management

```bash
claude -p "prompt"                          # Non-interactive print mode
claude -p --verbose --output-format stream-json  # Streaming NDJSON (--verbose REQUIRED)
claude -p --input-format stream-json        # Streaming JSON input (multi-turn via stdin)
claude -p --include-partial-messages        # Word/phrase-level streaming via stream_event wrapper (opt-in)
claude -p --replay-user-messages            # Echo user messages on stdout for correlation
claude -p --session-id <uuid>              # Use a specific session ID
claude -r <session-id>                      # Resume an existing session
claude -c                                   # Continue most recent session in cwd
claude -p --fork-session                    # Branch from a resumed session (use with --resume)
claude -p --no-session-persistence          # Don't save session to disk
```

### Model and Execution

```bash
claude -p --model <model>                   # Model selection (alias or full name)
claude -p --fallback-model <model>          # Auto-fallback on overload
claude -p --max-turns <n>                   # Limit API roundtrips (hidden flag, not in --help, but works)
```

### Tool Control

```bash
claude -p --allowed-tools "Bash Edit Read"  # Restrict available tools
claude -p --disallowed-tools "Bash"         # Deny specific tools
claude -p --permission-mode bypassPermissions  # Skip permission prompts
claude -p --dangerously-skip-permissions    # Bypass all checks (sandbox only)
```

### Configuration

```bash
claude -p --system-prompt "..."             # Custom system prompt
claude -p --append-system-prompt "..."      # Append to default system prompt
claude -p --mcp-config <path>              # Load MCP server config
claude -p --add-dir <dirs...>              # Additional directories for tool access
```

### Notes

- `--verbose` is **required** for `--output-format stream-json`. Without it: `"When using --print, --output-format=stream-json requires --verbose"`.
- `--max-turns` is hidden (not in `--help`) but works. Tested with `--max-turns 1`.
- `--max-budget-usd` exists but is irrelevant for subscription-based usage.

---

## Spawning Sessions

Aurore's full spawn command for a session:

```typescript
interface SessionConfig {
  id: string
  workingDirectory: string
  resume?: string       // resume existing Claude Code session by ID
  fork?: boolean        // fork instead of mutating the resumed session
}

function spawnSession(config: SessionConfig): ChildProcess {
  const args = [
    '-p',
    '--verbose',                  // REQUIRED for stream-json output
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
  ]

  if (config.resume) {
    args.push('--resume', config.resume)
    if (config.fork) {
      args.push('--fork-session')
    }
  }

  // Replay user messages so Aurore can correlate request/response pairs
  args.push('--replay-user-messages')

  // Stream partial messages for fluid UI updates
  args.push('--include-partial-messages')

  return Bun.spawn(['claude', ...args], {
    cwd: config.workingDirectory,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
}
```

### Sending a Prompt

```typescript
function sendPrompt(session: ChildProcess, prompt: string): void {
  const message = JSON.stringify({
    type: 'user',
    message: { role: 'user', content: prompt },
  })
  session.stdin.write(message + '\n')
}
```

---

## Stream-JSON Output Format

The `--output-format stream-json` flag emits newline-delimited JSON (NDJSON). Messages arrive in this order per turn.

### 1. Hook Messages (if hooks are configured)

```json
{
  "type": "system",
  "subtype": "hook_started",
  "hook_id": "uuid",
  "hook_name": "SessionStart:startup",
  "hook_event": "SessionStart",
  "uuid": "uuid",
  "session_id": "uuid"
}
```
```json
{
  "type": "system",
  "subtype": "hook_response",
  "hook_id": "uuid",
  "hook_name": "SessionStart:startup",
  "hook_event": "SessionStart",
  "output": "",
  "stdout": "",
  "stderr": "",
  "exit_code": 0,
  "outcome": "success",
  "uuid": "uuid",
  "session_id": "uuid"
}
```

### 2. Init Message

Rich metadata emitted once at session start.

```json
{
  "type": "system",
  "subtype": "init",
  "cwd": "/workspace/canon",
  "session_id": "8fef49ed-29a7-408f-8c31-44889ec2eb62",
  "tools": ["Bash", "Read", "Edit", "Write", "Glob", "Grep"],
  "mcp_servers": [],
  "model": "claude-opus-4-6",
  "permissionMode": "default",
  "slash_commands": ["..."],
  "apiKeySource": "none",
  "claude_code_version": "2.1.47",
  "agents": ["..."],
  "skills": ["..."],
  "plugins": [{"name": "...", "path": "..."}],
  "uuid": "uuid",
  "fast_mode_state": "off"
}
```

Key fields for Aurore:
- `session_id` — for annotation targeting and session management
- `model` — display which model is active
- `tools` — show available capabilities
- `apiKeySource: "none"` — confirms subscription auth (no API key)

### 3. Rate Limit Event

Only emitted with `--include-partial-messages`.

```json
{
  "type": "rate_limit_event",
  "rate_limit_info": {
    "status": "allowed",
    "resetsAt": 1771484400,
    "rateLimitType": "five_hour",
    "overageStatus": "allowed",
    "overageResetsAt": 1772323200,
    "isUsingOverage": false
  },
  "uuid": "uuid",
  "session_id": "uuid"
}
```

Key fields for Aurore:
- `status` — show rate limit warnings in session status
- `rateLimitType` — indicates the billing window ("five_hour")
- `resetsAt` — countdown timer for rate limit recovery

### 4. Stream Events (with `--include-partial-messages`)

SSE-like events wrapped in `stream_event` objects. Follow the Anthropic streaming API format:

```json
// Stream start
{"type":"stream_event","event":{"type":"message_start","message":{"model":"claude-opus-4-6","id":"msg_...","content":[],"stop_reason":null,"usage":{}}}}

// Content block start
{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}}

// Text deltas (word/phrase level granularity, 1-6 words per delta)
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Cats are independent creatures"}}}
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" that have"}}}
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" been domesticated..."}}}

// Content block end
{"type":"stream_event","event":{"type":"content_block_stop","index":0}}

// Message end with stop reason
{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":94}}}
{"type":"stream_event","event":{"type":"message_stop"}}
```

Key observations:
- Streaming granularity is **word/phrase level**, not token-by-token. Each delta contains 1-6 words.
- All stream events carry `session_id` and `parent_tool_use_id` (null for main conversation).
- Each stream event has its own `uuid`.
- The **complete `assistant` message is ALSO emitted** between the deltas and the stop events — Aurore can either accumulate deltas for live streaming or wait for the complete message.

### 5. Assistant Message

Wraps the Anthropic API response format.

```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-6",
    "id": "msg_01JYZkZd9vuxSrXKvM9SrtQi",
    "type": "message",
    "role": "assistant",
    "content": [
      {"type": "text", "text": "hello world"}
    ],
    "stop_reason": null,
    "usage": { "input_tokens": 3, "output_tokens": 1 }
  },
  "parent_tool_use_id": null,
  "session_id": "uuid",
  "uuid": "99c5642b-e11e-4327-a991-85058a77c369"
}
```

Content block types:
- `{"type": "text", "text": "..."}` — plain text response
- `{"type": "tool_use", "id": "toolu_...", "name": "Edit", "input": {...}}` — tool call
- `{"type": "thinking", "thinking": "...", "signature": "..."}` — extended thinking (when enabled)

Key fields for Aurore:
- `uuid` — stable annotation target ID
- `message.content[]` — array of content blocks to render
- `parent_tool_use_id` — non-null when this is a subagent response

### 6. User Message (tool results)

When Claude uses tools, the tool results appear as user messages:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "tool_use_id": "toolu_01RQUxbcwiHAj9vcsghmXCeX",
      "type": "tool_result",
      "content": "File created successfully at: /path/to/file.md"
    }]
  },
  "parent_tool_use_id": null,
  "session_id": "uuid",
  "uuid": "uuid",
  "tool_use_result": {
    "type": "create",
    "filePath": "/path/to/file.md",
    "content": "...",
    "structuredPatch": [],
    "originalFile": null
  }
}
```

Key fields for Aurore:
- `tool_use_result` — structured representation of what the tool did (file creates, edits, etc.)
- Primary data source for live file change detection (better than filesystem watching)

### 7. Result Message (session summary)

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 2288,
  "num_turns": 1,
  "result": "hello world",
  "session_id": "8fef49ed-29a7-408f-8c31-44889ec2eb62",
  "total_cost_usd": 0.15328375,
  "usage": { "input_tokens": 3, "output_tokens": 5 },
  "permission_denials": [],
  "uuid": "uuid"
}
```

Key fields for Aurore:
- `session_id` — for session resumption with `--resume`
- `num_turns` — display in session info
- `is_error` — detect failed sessions
- `permission_denials` — surface when Claude was blocked from an action

### Common Fields

Every message carries a `uuid` field — this is the stable identifier Aurore uses for annotation targeting. The conversation panel renders each message as a distinct, selectable block.

---

## Sending Input (stdin)

With `--input-format stream-json`, Aurore pipes prompts to stdin as NDJSON (one JSON object per line).

### Validated Input Format

```jsonl
{"type":"user","message":{"role":"user","content":"Fix the bug in auth.ts line 42"}}
```

Both string and array content work:
```jsonl
{"type":"user","message":{"role":"user","content":"plain text prompt"}}
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"array format"}]}}
```

A custom `uuid` field is accepted but optional:
```jsonl
{"type":"user","message":{"role":"user","content":"..."},"uuid":"custom-id"}
```

### Multi-Turn Behavior

Multiple NDJSON lines on stdin are processed sequentially within a single process:

```bash
printf '{"type":"user","message":{"role":"user","content":"remember the word pineapple"}}\n{"type":"user","message":{"role":"user","content":"what word did I ask you to remember?"}}' \
  | claude -p --input-format stream-json --output-format stream-json --verbose
```

This produced: Claude saved "pineapple" (using tools across multiple API turns), then answered "pineapple" from the second message. All within one process invocation, one session. The `result` message reports `num_turns: 3` (counts API roundtrips, not user messages) and a single `result` at the end.

Aurore composes each prompt from annotations and writes it to the session's stdin as a single NDJSON line. The process stays alive across turns — no need to respawn per prompt.

### Invalid Formats (Tested)

| Format | Result |
|--------|--------|
| `{"type":"user","content":"..."}` (no `message` wrapper) | **Fails** — `TypeError: undefined is not an object (evaluating 'R.message.role')` |
| `{"role":"user","content":"..."}` (no `type` wrapper) | **Hangs** — process emits init/hook but never processes input |
| Two JSON objects on same line | **Fails** — JSON parse error. Strict NDJSON: one object per line |

### Replay Messages (`--replay-user-messages`)

When enabled, user messages are echoed on stdout with `isReplay: true` flag. The replayed message includes the full user message content, a server-assigned `uuid`, `session_id`, and `parent_tool_use_id`. This lets Aurore distinguish echoed user input from tool-result user messages in the stream.

---

## TypeScript Interfaces

### Extended Annotation Model

```typescript
// Current: code-only annotations
interface Annotation {
  id: string
  file: string
  lineStart: number
  lineEnd?: number
  comment: string
  kind: AnnotationKind
}

// Proposed: multi-target annotations
interface Annotation {
  id: string
  target:
    | { type: 'code'; file: string; lineStart: number; lineEnd?: number }
    | { type: 'conversation'; sessionId: string; messageId: string;
        offsetStart?: number; offsetEnd?: number }
    | { type: 'tool-call'; sessionId: string; toolUseId: string }
  comment: string
  kind: AnnotationKind
}
```

### Extended Output Format

```xml
<aurore-feedback>
  <code-annotations>
    <file path="src/auth.ts">
      <annotation type="line" line="42">
        <comment>Use bcrypt instead of md5 here</comment>
      </annotation>
    </file>
  </code-annotations>

  <conversation-annotations session="abc123">
    <annotation message-id="msg_01" selection="lines 3-5">
      <comment>This assumption is wrong — the API returns 401 not 403</comment>
    </annotation>
    <annotation message-id="msg_03" type="tool-call" tool-use-id="tu_02">
      <comment>Don't delete this file, it's needed by the test suite</comment>
    </annotation>
  </conversation-annotations>

  <summary actions="2" questions="1" files="1"
           conversation-annotations="2" sessions="1" />
</aurore-feedback>
```

---

## Validation Log

All findings from live CLI testing (Claude Code v2.1.47).

### Validated

1. **Stream-JSON schemas** — Seven message types documented with full field-level schemas from real CLI output.
2. **`--verbose` required** — Without it: `"When using --print, --output-format=stream-json requires --verbose"`.
3. **Partial message streaming** — `--include-partial-messages` emits `stream_event` wrapper with SSE-like events. Granularity: word/phrase level (1-6 words per delta).
4. **Session resumption** — `--resume <session_id>` restores full conversation context including tool call results.
5. **Stdin input format** — Correct format is `{"type":"user","message":{"role":"user","content":"..."}}`. The `message` wrapper is required.
6. **Multi-turn stdin** — Multiple NDJSON lines processed sequentially in a single process.
7. **`--replay-user-messages`** — Echoes user messages with `isReplay: true` flag for request/response correlation.
8. **`--max-turns`** — Works despite not being in `--help`. Hidden/undocumented flag.

### Discovered

9. **Extended thinking** — Assistant messages can contain `{"type": "thinking", "thinking": "...", "signature": "..."}` content blocks.
10. **`rate_limit_event`** — Emitted with partial messages, includes subscription rate limit status, reset times, overage info.
11. **`tool_use_result` structure** — User messages for tool results include structured diffs (`type: "create"`, `filePath`, `content`, `structuredPatch`). Better data source for file change detection than filesystem watching.

### Confirmed Non-Issues

12. **Concurrent session limits** — No known hard limits at the CLI level. Max plan rate limits may constrain throughput.
13. **Nested session guard** — Claude Code checks `CLAUDECODE` env var to prevent nesting. Not a concern for Aurore since Aurore is not a Claude Code session.

---

## Discovered Flags Useful for Aurore

| Flag | Use Case |
|------|----------|
| `--fork-session` | Session branching from a resume point (Tier 3: Session Forking) |
| `--permission-mode` | Expose as session config option (`bypassPermissions`, `acceptEdits`) |
| `--append-system-prompt` | Inject annotation state or session awareness into Claude's context |
| `--add-dir` | Multi-project sessions across different directories |
| `--fallback-model` | Auto-fallback on model overload for better UX |
| `--no-session-persistence` | Ephemeral/scratch sessions that don't pollute session history |

---

## Implementation Notes

### WebSocket Reconnection

The browser-to-Aurore server WebSocket connection should implement client-side reconnection with exponential backoff. If the connection drops (server restart, network blip), the client reconnects and replays the current session state from the server. Bun's native WebSocket support is mature, but reconnection logic is Aurore's responsibility.

### Stream-JSON Error Detection

If the `claude -p` subprocess emits no NDJSON after startup, detect and surface a clear error. The most common cause is a missing `--verbose` flag (required for `--output-format stream-json`). Check stderr for the error message: `"When using --print, --output-format=stream-json requires --verbose"`.
