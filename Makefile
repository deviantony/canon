.PHONY: install dev ide

dev:
	@CANON_PORT=9847 CANON_REMOTE=1 bun run src/cli/index.ts & PID=$$!; \
	trap "kill $$PID 2>/dev/null" EXIT; \
	bunx vite --port 6443 --host

ide:
	CANON_IDE_PORT=6443 CANON_REMOTE=1 bun run src/cli/ide.ts

install:
	bun run build
	cp canon ~/.local/bin/canon
	chmod +x ~/.local/bin/canon
	cp commands/new.md .claude/commands/canon-dev.md
