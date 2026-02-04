---
description: Open interactive code review for current changes
allowed-tools: Bash(canon:*)
---

## Code Review Feedback

!`canon`

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
