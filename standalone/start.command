#!/bin/zsh
set -eu
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null; then
  for candidate in "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/node" "$HOME/.codex/bin/node"; do
    if [[ -x "$candidate" ]]; then export PATH="$(dirname "$candidate"):$PATH"; break; fi
  done
fi
if ! command -v node >/dev/null; then print 'Node.js 24 or newer is required.'; read; exit 1; fi
(sleep 2; open http://127.0.0.1:4329/) &
exec caffeinate -i node standalone/app.mjs --autostart
