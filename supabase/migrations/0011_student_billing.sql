-- Ashley Bands — Per-student billing & financial record (marching band fees, etc.)
-- Anchored to portal_students.id. Charges = what a student owes; payments = money
-- received (online via PayPal + offline checks/cash/credits). Balance is a view.
-- Browser code must NOT query these directly; API routes use SUPABASE_SECRET_KEY
-- and enforce access rules server-side (portal session for families, staff session
-- for admin). All money stored as integer cents — never floats.

create extension if not exists "pgcrypto";

-- ============ Charges (what a student owes) ============

create table if not exists fee_charges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  category text not null default 'marching_band_2026',
  label text not null default '',
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'active'
    check (status in ('active','void')),
  source text not null default 'manual'
    check (source in ('manual','bulk')),
  created_by text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ Payments (money received: online + offline) ============

create table if not exists fee_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  method text not null
    check (method in ('paypal','check','cash','credit','sponsorship','adjustment')),
  status text not null default 'pending'
    check (status in ('pending','completed','refunded','failed')),
  category text not null default 'marching_band_2026',
  -- our own id, also sent to PayPal as invoice_id for reconciliation
  invoice_id text not null unique,
  paypal_order_id text not null default '',
  paypal_capture_id text not null default '',
  -- 'family_online' for self-serve, otherwise the staff display_name who recorded it
  recorded_by text not null default '',
  received_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ PayPal webhook idempotency / dedupe ============

create table if not exists paypal_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null default '',
  resource_id text not null default '',
  received_at timestamptz not null default now()
);

-- ============ Indexes ============

create index if not exists fee_charges_student_idx on fee_charges(student_id);
create index if not exists fee_charges_status_idx on fee_charges(status);
create index if not exists fee_payments_student_idx on fee_payments(student_id);
create index if not exists fee_payments_status_idx on fee_payments(status);
create index if not exists fee_payments_order_idx on fee_payments(paypal_order_id);

-- ============ Balance view (per student) ============
-- charged   = sum of active charges
-- paid      = sum of completed payments
-- balance   = charged - paid  (can be negative if overpaid/credited)

create or replace view student_fee_balances as
with charged as (
  select student_id, coalesce(sum(amount_cents), 0)::bigint as charged_cents
  from fee_charges
  where status = 'active'
  group by student_id
),
paid as (
  select student_id, coalesce(sum(amount_cents), 0)::bigint as paid_cents
  from fee_payments
  where status = 'completed'
  group by student_id
),
ids as (
  select student_id from charged
  union
  select student_id from paid
)
select
  ids.student_id,
  coalesce(c.charged_cents, 0) as charged_cents,
  coalesce(p.paid_cents, 0) as paid_cents,
  coalesce(c.charged_cents, 0) - coalesce(p.paid_cents, 0) as balance_cents
from ids
left join charged c on c.student_id = ids.student_id
left join paid p on p.student_id = ids.student_id;

-- ============ updated_at triggers (reuses set_updated_at from 0006) ============

drop trigger if exists fee_charges_updated_at on fee_charges;
create trigger fee_charges_updated_at
  before update on fee_charges
  for each row execute function set_updated_at();

drop trigger if exists fee_payments_updated_at on fee_payments;
create trigger fee_payments_updated_at
  before update on fee_payments
  for each row execute function set_updated_at();

-- ============ RLS ============
-- API routes use SUPABASE_SECRET_KEY (bypasses RLS) and enforce access server-side.

alter table fee_charges enable row level security;
alter table fee_payments enable row level security;
alter table paypal_webhook_events enable row level security;
