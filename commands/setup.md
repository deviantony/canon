---
description: Install or update the Canon binary to the latest version
allowed-tools: Bash(curl:*), Bash(chmod:*), Bash(mkdir:*), Bash(canon:*), Bash(uname:*), Bash(mv:*)
---

# Canon Setup

Install or update the Canon binary for your platform.

## Instructions

Execute these steps in order:

### 1. Detect Platform

Determine the user's OS and architecture:

```bash
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Normalize OS
case "$OS" in
  darwin) OS="darwin" ;;
  linux) OS="linux" ;;
  mingw*|msys*|cygwin*) OS="windows" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

# Normalize architecture
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Validate platform combination
PLATFORM="${OS}-${ARCH}"
case "$PLATFORM" in
  linux-x64|linux-arm64|darwin-arm64|windows-x64) ;;
  darwin-x64) echo "macOS Intel (x64) is not supported. Only Apple Silicon (arm64) is supported."; exit 1 ;;
  *) echo "Unsupported platform: $PLATFORM"; exit 1 ;;
esac

echo "Detected platform: $PLATFORM"
```

### 2. Check Current Version

Check if Canon is already installed and get its version:

```bash
if command -v canon &> /dev/null; then
  CURRENT_VERSION=$(canon --version 2>/dev/null || echo "unknown")
  echo "Current version: $CURRENT_VERSION"
else
  CURRENT_VERSION=""
  echo "Canon is not currently installed"
fi
```

### 3. Fetch Latest Version

Get the latest release version from GitHub:

```bash
LATEST_RELEASE=$(curl -s https://api.github.com/repos/deviantony/canon/releases/latest)
LATEST_VERSION=$(echo "$LATEST_RELEASE" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
echo "Latest version: $LATEST_VERSION"
```

### 4. Compare Versions

If already up to date, skip installation:

```bash
if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
  echo "Canon is already up to date (v$LATEST_VERSION)"
  exit 0
fi
```

### 5. Download and Install

Download the binary and install it:

```bash
# Determine install directory
INSTALL_DIR="${CANON_BIN_DIR:-$HOME/.local/bin}"
mkdir -p "$INSTALL_DIR"

# Determine file extension and binary name
if [ "$OS" = "windows" ]; then
  EXT=".exe"
  BINARY_NAME="canon.exe"
else
  EXT=""
  BINARY_NAME="canon"
fi

# Download URL
DOWNLOAD_URL="https://github.com/deviantony/canon/releases/download/v${LATEST_VERSION}/canon-${LATEST_VERSION}-${PLATFORM}${EXT}"

echo "Downloading from: $DOWNLOAD_URL"
curl -L -o "${INSTALL_DIR}/${BINARY_NAME}" "$DOWNLOAD_URL"

# Make executable (non-Windows)
if [ "$OS" != "windows" ]; then
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
fi

echo "Installed Canon v${LATEST_VERSION} to ${INSTALL_DIR}/${BINARY_NAME}"
```

### 6. Verify Installation

Verify the installation was successful:

```bash
if [ "$OS" = "windows" ]; then
  "${INSTALL_DIR}/canon.exe" --version
else
  "${INSTALL_DIR}/canon" --version
fi
```

## Summary

After completing all steps, report:
- The installed version
- The installation location
