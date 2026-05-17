-- Phase C: explicit send queue + status for business_outreach rows
-- Queueing happens on the web dashboard; actual sending runs from a local
-- script (drain-send-queue.mjs) using gws gmail. This separates intent from
-- dispatch so the web app never needs Gmail API credentials.

alter table business_outreach
  alter column sent_at drop default,
  alter column sent_at drop not null,
  add column if not exists queued_at timestamptz not null default now(),
  add column if not exists send_status text not null default 'queued'
    check (send_status in ('queued','sent','failed','skipped')),
  add column if not exists send_error text,
  add column if not exists yes_url text,
  add column if not exists no_url text;

create index if not exists business_outreach_send_status_idx on business_outreach(send_status);
create index if not exists business_outreach_queued_idx on business_outreach(send_status, queued_at);
