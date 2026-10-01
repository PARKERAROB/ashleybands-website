#!/usr/bin/env bash
# Use the repository runtime in interactive shells and fresh agent processes.
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
required="$(cat "$repo_root/.nvmrc")"
if [[ "$(node --version 2>/dev/null || true)" != "v$required" ]]; then
  if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    # npm run exports npm_config_prefix, which nvm refuses to run beside (#94).
    unset npm_config_prefix
    source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    nvm use --silent "$required" >/dev/null
    # nvm swaps its PATH entry in place; an earlier node (e.g. ~/.local/bin) can still win.
    PATH="$(dirname "$(nvm which "$required")"):$PATH"
    export PATH
  else
    echo "Runtime setup needed: install Node $required (see .nvmrc), then retry." >&2
    exit 1
  fi
fi
exec "$@"
