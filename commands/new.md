---
description: Open annotation session to annotate code with line-specific feedback
allowed-tools: Bash(command:*), Bash(canon:*)
---

## Binary Check

First, verify the Canon binary is installed by running:

```bash
command -v canon >/dev/null 2>&1 && echo "INSTALLED" || echo "NOT_INSTALLED"
```

If the output is "NOT_INSTALLED", stop immediately and tell the user:

**Canon binary not found.** Run `/canon:setup` to install it.

Do not proceed further if the binary is not installed.

## Code Review Feedback

Only if the binary is installed, run:

```bash
canon
```

## Your Task

Address the code review feedback above. The feedback is provided as XML with this structure:
- `<file path="...">` - groups annotations by file
- `<annotation type="file|line|range">` - individual annotations with optional `line` or `start`/`end` attributes
- `<comment>` - the reviewer's feedback

For each annotation:

1. Read the file and line number referenced
2. Understand the context of the feedback
3. Make the requested changes or explain why you disagree
4. If the feedback mentions other files with @mentions, check those files for context

If the user cancelled the review, ask what they'd like to do next.
