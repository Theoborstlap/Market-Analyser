#!/usr/bin/env zsh
set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$ROOT_DIR/start_unified_terminal.sh" "$@"
