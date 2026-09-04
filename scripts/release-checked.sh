#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

npm run verify:release

branch="$(git branch --show-current)"
if [[ "$branch" != "main" ]]; then
  echo "Checked release blocked: expected main, found ${branch:-detached HEAD}." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Checked release blocked: verification changed the working tree or intended changes are uncommitted." >&2
  git status --short >&2
  exit 1
fi

released_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse origin/main)"
if [[ "$released_sha" != "$remote_sha" ]]; then
  echo "Checked release blocked: local main must exactly match origin/main before deployment." >&2
  exit 1
fi

started_at="$(node -e 'process.stdout.write(String(Date.now()))')"
npx --yes vercel@59.1.4 --prod --yes \
  --scope robs-projects-9eb69de7 \
  --project band-website \
  --meta "validationCommit=$released_sha"
npm run verify:live -- --expected-commit "$released_sha" --not-before "$started_at"
