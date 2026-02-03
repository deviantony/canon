.PHONY: install

install:
	bun run build
	cp canon ~/.local/bin/canon
	chmod +x ~/.local/bin/canon
