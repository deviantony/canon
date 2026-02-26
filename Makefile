.PHONY: dev

dev:
	@AURORE_REMOTE=1 bun run src/cli/aurore.ts & PID=$$!; \
	trap "kill $$PID 2>/dev/null" EXIT; \
	bunx vite --port 6443 --host
