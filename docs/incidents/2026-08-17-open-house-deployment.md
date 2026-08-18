# Open House deployment incident — 2026-08-17

## Outcome

The Open House collection was deployed directly to Vercel and aliased to `ashleybands.com`.
The instrument-request, clothing-order, and security migrations are applied through migration
`0039`. All five checked public and administrative routes returned HTTP 200 after deployment.
No family broadcast was sent.

## What failed

Four separate conditions overlapped and initially looked like one deployment failure.

1. **Supabase project throttling.** The Nano database had consumed its Disk IO budget. The database
   remained present, but PostgREST timed out and the dashboard reported the project as unhealthy.
   The July 16 warning predates the Open House changes.
2. **Migration-history mismatch.** Production carried a `20260316` baseline while the repository
   used numbered migrations. The schema was already present, but the ledger did not show migrations
   `0001`–`0036`. Their history entries were repaired as applied; they were not replayed. Migrations
   `0037`–`0039` were then applied normally and confirmed in the remote ledger.
3. **Node 20 client compatibility.** `@supabase/supabase-js` initialized Realtime while the portal
   validation script ran under Node 20, which has no native WebSocket implementation. The checked
   deploy stopped before Vercel. The script now supplies the `ws` transport explicitly.
4. **Vercel identity block.** Vercel Hobby-team protection rejected deployments whose HEAD commit
   used `parkerarob@users.noreply.github.com`. The CLI displayed those deployments as `UNKNOWN`, but
   the deployment API reported `BLOCKED` with a zero-millisecond build. A HEAD commit authored by
   `Rob Parker <robert.parker@nhcs.net>`, the verified Vercel identity, cleared the block.

During recovery, `vercel pull` returned masked placeholder values for sensitive production variables.
A local `vercel build --prod` treated those placeholders as literal values and rejected the Supabase
URL. That did not prove the hosted variables were corrupt. The four Supabase production variables were
nevertheless replaced from the known-good local production configuration before the final direct build.
The normal checked deployment uses Vercel's production environment remotely and does not depend on a
pulled sensitive-value file.

## Durable controls added

- `npm run deploy:preflight` now refuses a production deploy unless:
  - the branch is `main`;
  - HEAD uses the verified Vercel author email;
  - `.vercel/project.json` identifies the AshleyBands production project and team;
  - the local Supabase link, when present, identifies project `edcmfzxqtdbgygeimedo`;
  - the production Supabase URL matches that project and PostgREST responds within 15 seconds; and
  - Vercel is authenticated as the production account.
- `npm run deploy:checked` runs that preflight and pins the Vercel CLI version used for deployment.
- `npm run supabase:production -- <command>` refuses the wrong linked project and removes the stale
  `SUPABASE_ACCESS_TOKEN` override before invoking the Supabase CLI.
- Public views are set to `security_invoker = true` in migration `0039`, covering all nine public
  views rather than only the three reported by Security Advisor.

## Recovery procedure

1. Run `npm run deploy:preflight`. Do not proceed if the Supabase REST health check fails.
2. If Supabase is slow or PostgREST is unhealthy, check the project Disk IO budget. Wait for recovery
   or increase compute capacity; repeated deployment attempts add load but do not restore the budget.
3. Use `npm run supabase:production -- migration list` before and after database changes.
4. Use `npm run deploy:checked` for production. A zero-millisecond `UNKNOWN` Vercel deployment means
   inspect `readyState` for `BLOCKED` and verify the HEAD author identity before rebuilding.
5. Do not diagnose masked values from `.vercel/.env.production.local` as corrupt hosted secrets.
   Validate the named production variables in Vercel or use the normal remote production build.
6. Verify the intended `ashleybands.com` routes after Vercel reports `READY` and assigns the alias.

## Remaining exposure

The software now detects an unhealthy Supabase REST service and prevents publication into that state,
but it cannot replenish a Nano Disk IO budget. Capacity remains a hosting decision. If throttling
recurs during ordinary family use, the production compute size needs review. Security Advisor also
refreshes asynchronously; migration `0039` is confirmed applied, but the dashboard should be refreshed
to confirm its critical count has cleared.
