# Database memory and Disk IO outage — 2026-10-21

## Outcome

From about 6:50 AM to 7:45 AM ET, the Carnegie funding tracker and the Band Assistant were down.
Public pages that do not read the database, including the Fall Concert program, stayed up. Rob
upgraded the organization to Supabase Pro and resized the project from Nano to Micro. The database
restarted at 7:56 AM ET. Afterward the tracker, assistant, portal, and homepage all answered
normally. (#220)

## What failed

1. **Memory pressure on Nano.** The Nano instance had about 411 MB of RAM. Memory commitment was
   1.39 GB, and swap held 408 MB, essentially all of RAM, for the whole prior day. The band's own
   load was light: a 51 MB database, 11 idle PostgREST connections, stock settings, and about 60
   tracker reads an hour. The Supabase service stack itself filled the memory.
2. **Swap drained the Disk IO budget.** Constant swapping spent the burst Disk IO budget. When the
   budget ran out, disk throughput fell to the 5 MB/s baseline. At 6:35 AM ET, Supabase's trivial
   `default_transaction_read_only` health query took 13.6 seconds. From 6:50 AM ET, statements hit
   `statement_timeout` and PostgREST returned 504s, even though the project status stayed
   `ACTIVE_HEALTHY`.
3. **Both features depend on the database.**
   - `/api/carnegie-2027/funding` reads `fee_payments` and `sponsor_gifts`. It hit Vercel's 60-second
     function limit.
   - `/api/chat` checks its rate limit in Supabase and fails closed. It hung until that check timed
     out.

Since May, the database also recorded about 590 GB of temporary files. Only about 0.5 GB of that
appears in `pg_stat_statements`. That backlog was not the trigger: temp writing was quiet during the
investigation.

## Resolution

- Organization plan: Free to Pro ($25/month; includes $10/month compute credit).
- Compute: Nano (t4g.nano, 0.5 GB) to Micro (t4g.micro, 1 GB) at the same hourly rate, which the
  credit covers.
- Spend cap left enabled.
- After the resize: RAM 904 MB, 546 MB available, swap 100 MB. Funding returned 200 in 0.2 s; chat
  answered in 2.8 s.

This supersedes the "capacity remains a hosting decision" exposure in the
[2026-08-17 incident](2026-08-17-open-house-deployment.md).

## Diagnosis procedure

1. Check `/api/carnegie-2027/funding` and `/api/chat`. If both stall, suspect the database first.
2. Query PostgREST directly with a 15-second timeout. If the gateway answers fast without a key but
   keyed queries hang, the database is starved.
3. In the dashboard, check the Disk IO budget banner and the Observability → Database memory chart.
   The swap series is the signal.
4. Memory and swap can be read without the dashboard. Fetch
   `<SUPABASE_URL>/customer/v1/privileged/metrics` with basic auth `service_role:<secret key>`, then
   read `node_memory_*`.

## Remaining exposure

- Not yet observed: whether the Disk IO budget refills fully on Micro. Watch the dashboard banner over
  the next few days.
- If swap climbs back toward RAM size on Micro, the next step is Small (2 GB). That increase is a
  spending decision.
- Unexplained: the temporary-file volume. If it recurs, set `log_temp_files` to find the source.
