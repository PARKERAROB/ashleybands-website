-- Fixed-window rate-limit counters for auth endpoints (staff PIN login,
-- portal magic-link requests). Keyed string -> count within a time window.
-- Service-key API routes read/write this; RLS on, browser has no access.

create table if not exists auth_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table auth_rate_limits enable row level security;
