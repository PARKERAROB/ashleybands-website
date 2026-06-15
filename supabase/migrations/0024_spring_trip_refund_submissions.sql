-- 0024_spring_trip_refund_submissions.sql
-- Public Spring-Trip 2026 refund-choice form (ashleybands.com/spring-trip-refund).
-- ONE row per family submission. CAPTURE-ONLY: the public form records each family's
-- stated choice; it moves NO money. The treasurer reviews these rows and processes
-- each one (cut a check, apply the credit to the MB funding goal, or log the donation).
-- An unauthenticated public form must never write to funding goals directly, so this
-- table is a capture surface, not a money-mutation path.
--
--   refund_choice 'apply_mb_2026' -> credit toward the student's 2026 marching-band season
--   refund_choice 'refund'        -> refund check (pickup at school or mailed)
--   refund_choice 'donate'        -> donate the refund to the Boosters (501c3)
--
--   status 'new'       -> submitted, awaiting treasurer processing (default)
--   status 'processed' -> the treasurer has actioned it
--   status 'void'      -> duplicate / test / withdrawn

create table if not exists spring_trip_refund_submissions (
  id                       uuid primary key default gen_random_uuid(),
  student_first_name       text not null,
  student_last_name        text not null,
  guardian_name            text not null,
  guardian_email           text not null,
  guardian_phone           text not null,
  amount_paid              text not null,
  refund_choice            text not null
                             check (refund_choice in ('apply_mb_2026', 'refund', 'donate')),
  check_payable_to         text,
  check_delivery           text check (check_delivery in ('pickup', 'mail')),
  mailing_address          text,
  hardship_full_refund     boolean not null default false,
  deduction_acknowledgment boolean not null default false,
  notes                    text,
  parent_signature         text not null,
  status                   text not null default 'new'
                             check (status in ('new', 'processed', 'void')),
  created_at               timestamptz not null default now()
);

-- Treasurer reviews newest-first / by status.
create index if not exists spring_trip_refund_submissions_status_idx
  on spring_trip_refund_submissions (status, created_at desc);

-- Service-key API only (no public/anon access). RLS on, no policies = deny all to anon.
alter table spring_trip_refund_submissions enable row level security;
