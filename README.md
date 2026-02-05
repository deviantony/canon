# Canon

A browser-based annotation tool for Claude Code that lets you add line-specific feedback to any file, with annotations flowing back into your conversation as structured context.

## Install

Outside of a Claude Code session, run:

```bash
claude plugin marketplace add deviantony/canon
claude plugin install -s project canon@canon
```

Then in a Claude Code session, run `/canon:setup` to download the binary for your platform.

**Supported platforms:** Linux (x64, arm64), macOS (Apple Silicon), Windows (x64)

## Usage

In a Claude Code session:

```
/canon:new
```

A browser window opens automatically at `http://localhost:9847`. Browse files, click lines to annotate, and submit to return feedback to Claude.

### Update

To update the plugin, outside of a Claude Code session run:

```bash
claude plugin marketplace update canon
claude plugin update -s project canon@canon
```

Then in a Claude Code session, run `/canon:setup` to update the binary.

Restart Claude Code after updating to ensure changes take effect.

### Custom Install Location

To install the binary to a custom location instead of `~/.local/bin`:

```bash
export CANON_BIN_DIR=/usr/local/bin
```

Then run `/canon:setup`.

### Container/Remote

If running Claude Code in a container or over SSH:

```bash
export CANON_PORT=9000
export CANON_REMOTE=1
claude  # then run /canon:new and open the URL manually
```
