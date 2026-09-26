#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
# Shared across clones/worktrees on this host; no automatic stale-lock stealing.
state_root="${XDG_STATE_HOME:-$HOME/.local/state}/ashleybands-release"
umask 077
mkdir -p "$state_root"
lock="$state_root/production.lock"
if ! mkdir "$lock" 2>/dev/null; then
  echo "Release blocked: another release holds $lock. See docs/RELEASING.md for interrupted-release recovery." >&2
  exit 1
fi
printf '%s\n' "$$" > "$lock/pid"
cleanup() { rm -f "$lock/pid"; rmdir "$lock"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
log="$(mktemp "$state_root/release.XXXXXX")"
phase() {
  echo "Release: $1 (log: $log)"
  local label="$1"
  shift
  if "$@" >>"$log" 2>&1; then
    echo "PASS  $label"
  else
    echo "FAIL  $label. Full local log: $log" >&2
    if [[ "${RELEASE_PUBLIC_OUTPUT:-0}" == 1 ]]; then
      # Public runner output: show check labels only, never raw log text or details.
      grep -E '^(PASS|FAIL|WARN)  |^not ok |^# (tests|pass|fail) ' "$log" | sed -E 's/ — .*$//' | tail -n 20 >&2 || true
    else
      tail -n 20 "$log" >&2
    fi
    return 1
  fi
}
phase readiness node scripts/release-ready.mjs
released_sha="$(git rev-parse HEAD)"
phase verification npm run verify:release
phase final-readiness node scripts/release-ready.mjs
if [[ "$(git rev-parse HEAD)" != "$released_sha" ]]; then
  echo "Release blocked: HEAD changed during verification. Retry against the new commit." >&2
  exit 1
fi
started_at="$(node -e 'process.stdout.write(String(Date.now()))')"
phase deployment npx --yes vercel@59.1.4 --prod --yes \
  --scope robs-projects-9eb69de7 --project band-website \
  --meta "validationCommit=$released_sha"
phase live-proof npm run verify:live -- --expected-commit "$released_sha" --not-before "$started_at"
echo "Release complete: $released_sha; ashleybands.com verified. Log: $log"
