-- 0021_spring_trip_refund_credits.sql
-- Spring-Trip forgo-to-MB feature.
-- One row per eligible spring-trip-payer-who-marches. The family can choose, ONCE,
-- to forgo their trip refund check and have it credited toward the student's
-- marching-band funding goal instead. All-or-nothing, one-time, final, no undo.
--
--   status 'offered'     -> family has not decided yet (seed state)
--   status 'applied_mb'  -> forwent the check; confirmed_cents credited to the goal
--                           (a fee_payments row of method 'credit' is written by the API)
--   status 'check'        -> chose the refund check; no payment written, balance unchanged
--
-- Amounts are integer cents. confirmed_cents = what we can credit now (conservative,
-- CharterUP courtesy check still out). topup_cents = the +$35/family that applies later
-- IF that check posts. full_cents = confirmed + topup (stored for the later top-up pass).
-- A check is NEVER cut for any overage (student-account gray area, banned by policy).

create table if not exists spring_trip_refund_credits (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references portal_students(id) on delete cascade,
  confirmed_cents integer not null check (confirmed_cents > 0),
  topup_cents     integer not null default 0 check (topup_cents >= 0),
  full_cents      integer not null check (full_cents > 0),
  status          text not null default 'offered'
                    check (status in ('offered', 'applied_mb', 'check')),
  applied_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- One credit row per student (idempotent seeding; one offer per family).
create unique index if not exists spring_trip_refund_credits_student_uniq
  on spring_trip_refund_credits (student_id);

-- Service-key APIs only (no public/anon access). RLS on, no policies = deny all to anon.
alter table spring_trip_refund_credits enable row level security;
