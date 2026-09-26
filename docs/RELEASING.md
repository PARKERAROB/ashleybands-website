# AshleyBands release recipe

## Prepare a checkout

Run `npm run setup:checkout`. The runtime wrapper selects the installed Node version in `.nvmrc`
through nvm when necessary. Install that version if it is absent. Setup uses `npm ci`; it refuses
external dependency symlinks and leaves package/lockfile discrepancies visible for correction.
It checks the local environment, canonical calendar checkout, and exact Vercel project/team link.
Use `BANDSOFAHS_DIR` for a non-sibling canonical checkout. The release suite currently expects
`.env.local` in this checkout (some individual tools also support `BAND_WEBSITE_ENV`). Provision
that ignored file from the trusted local environment; never print, publish, or commit secrets.
Setup reports the exact link command if `.vercel/project.json` is missing.

To look at changed pages before release, use `npm run preview:shots -- /route` (see
[LOCAL_PREVIEW.md](LOCAL_PREVIEW.md)). `npm run dev` refuses writes to production services unless
the shell sets `ALLOW_LOCAL_WRITES=1`.

For ad hoc Node scripts use `bash scripts/runtime.sh node <script>` and the existing
`scripts/lib/workspace-paths.mjs` environment loader. Inspect `npm run` and `rg --files` before
inventing commands or paths. Do not import an uninstalled environment helper.

## Prepare the release

1. Complete the issue's focused checks and integrate the intended files into `main`.
2. Refresh generated projections before committing. Preserve unrelated working-tree changes;
   use a separate checkout with its own installed dependencies if necessary.
3. Commit substantive work as Atlas. For an authorized production release, create the narrow
   compatibility commit required by the verified Vercel author identity:

   ```sh
   git -c user.name=parkerarob -c user.email=robert.parker@nhcs.net commit --allow-empty -m "Authorize production release (#ISSUE)" -m "Checked: <one line: what was actually verified before authorizing>"
   ```

   Replace ISSUE with the owning issue number. The `Checked:` trailer is required: readiness refuses
   an authorization commit without one, so the authorize pairing is evidence of review rather than a
   reflex (workshop#121). Say what you looked at, e.g. `Checked: preview route readback, calendar
   projection diff, no person data in the change`. This is already covered by standing publication
   authority; it does not reattribute the substantive work. Do not do this for investigate-only work.
4. Push `main`, then run `npm run release:checked`. `npm run deploy:checked` is the same path.

The wrapper acquires a project-wide lock across checkouts on this Mac, checks readiness and freshly
fetches `origin/main` before the expensive suite, then rechecks after verification. It refuses a
changed checkout or commit. All existing production checks remain required. Publication uses the
pinned CLI and verifies the exact commit against the final `ashleybands.com` alias. Verify affected
routes and risk-specific behavior as required by `PROJECT_WORKFLOW.md`.

The local lock cannot coordinate another machine or a raw dashboard/CLI deployment. Keep production
publication on this checked path and coordinate any other publisher; the final commit/domain proof
still detects a mismatched alias at the time it is checked.

## Release from GitHub

The `Release` workflow (`.github/workflows/release.yml`, #146) runs the same wrapper on a GitHub
runner, so a cloud agent can ship on Rob's say-so without the Mac.

1. Integrate and push the intended change to `main`, as above.
2. Start `Release` from the Actions tab (or `workflow_dispatch`) on `main` with the owning issue
   number and the one-line `Checked:` evidence.
3. The job waits for Rob's approval on the `production` environment. That approval is the
   authorization; the job then makes and pushes the narrow authorization commit itself.
4. `npm run release:checked` runs unchanged. The concurrency group allows one GitHub release at a
   time; it cannot coordinate with a Mac release, so do not run both at once.

One-time setup in GitHub settings for the `production` environment: Rob as required reviewer,
deployment branches limited to `main`, and these environment secrets (never paste them in chat):

- `BAND_WEBSITE_ENV_LOCAL`: the full contents of the trusted `.env.local`.
- `VERCEL_TOKEN`: a Vercel token for `robertparker-6198` with access to `robs-projects-9eb69de7`.
- `BANDSOFAHS_DEPLOY_KEY`: private half of a read-only deploy key on `PARKERAROB/BandsofAHS`.

GitHub offers required reviewers on private repositories only with GitHub Enterprise. Without one,
the job starts when dispatched, so only start it on Rob's explicit release instruction.

The runner uses the pushed `BandsofAHS` `main`, not a Mac working copy, so push calendar and roster
changes there first. While this repository is public its Actions logs are public: on failure the
runner prints only check labels, and the full log is discarded with the runner. Reproduce the
failing phase on the Mac to diagnose it. A private repository shows the usual log tail.

## Failure and recovery

Each phase prints a concise result and the full local log path. Logs and locks live outside Git in
`${XDG_STATE_HOME:-$HOME/.local/state}/ashleybands-release`, with private permissions. Logs may contain
sensitive diagnostics: inspect locally and sanitize excerpts before posting. Failed verification
never deploys. A live-proof failure means publication may already have happened: inspect the alias
before retrying, and use `verify:live` to repeat proof without redeploying.

The Regiment OS projection is checked before the expensive suite. Use the actual locally provisioned
`PORTAL_SESSION_SECRET`, verified against an authenticated live read. Vercel Sensitive environment
variables export as `[SENSITIVE]`; that marker is not a production key and must never override the
local key, sign a test cookie, or encrypt content. The builder rejects export placeholders. A failed
probe using a placeholder does not establish a production credential failure. Verify sensitive
settings through the running application, never by sending export markers to a provider.

Normal exit and interrupt release the lock. After an uncatchable kill, inspect `production.lock/pid`
and confirm that process and its deployment children have ended. Only then remove that stale lock
directory. Never automatically steal a lock or interrupt another release. A remote mismatch requires
integration and another verification run; never force-push to clear it.

## Historical context

Earlier recipes referenced `/deploy-website`, raw Vercel commands, and a separate live branch.
`main` is the production source; those older recipes are superseded by this file. Preview environment
parity is not established here. This cleanup does not change hosting accounts, preview configuration,
production runtime settings, or Vercel identity ownership.
