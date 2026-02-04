# Canon

A browser-based annotation tool for Claude Code that lets you add line-specific feedback to any file, with annotations flowing back into your conversation as structured context.

## Install

**1. Install the binary:**

```bash
git clone https://github.com/deviantony/canon.git
cd canon
npm install
npm run build
make install  # installs to ~/.local/bin
```

**2. Install the plugin:**

```
/plugin marketplace add deviantony/canon
/plugin install canon@canon
```

## Usage

In a Claude Code session:

```
/canon
```

A browser window opens automatically at `http://localhost:9847`. Browse files, click lines to annotate, and submit to return feedback to Claude.

### Container/Remote

If running Claude Code in a container or over SSH, set these environment variables before starting your session:

```bash
export CANON_PORT=9000
export CANON_REMOTE=1
claude  # then run /canon and open the URL manually
```
