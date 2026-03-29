#!/usr/bin/env bash
set -euo pipefail

# Install pnpm if not available
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi

# Symlink .env from main repo into this worktree
if [ ! -e .env ]; then
  GIT_COMMON_DIR=$(cd "$(git rev-parse --git-common-dir)" && pwd)
  MAIN_REPO=$(dirname "$GIT_COMMON_DIR")
  if [ -f "$MAIN_REPO/.env" ]; then
    ln -sf "$MAIN_REPO/.env" .env
    echo "Linked .env from $MAIN_REPO"
  else
    echo "ERROR: $MAIN_REPO/.env not found — create it before running setup" >&2
    exit 1
  fi
fi

# Install dependencies
pnpm install

# Generate Convex types (reads local schema, no network required)
pnpm exec convex codegen
