-- Issue #221: optional online (PayPal) payment of an All-County meals invoice, with a surcharge
-- that covers PayPal's fee. One row per PayPal order. Check and cash stay on
-- allcounty_meal_signups.paid_cents (staff-recorded); total received = that + completed rows here.
-- provenance: rows are created by the director's own "Pay online" action on /all-county/meals
-- (source = 'director_paypal') and settled from PayPal's capture response or webhook.
-- No payer card data is stored; PayPal hosts the payment sheet.
create table public.allcounty_meal_payments (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.allcounty_meal_signups(id) on delete restrict,
  invoice_id text not null unique check (invoice_id like 'AB-ACM-%'),
  meal_cents integer not null check (meal_cents > 0),
  surcharge_cents integer not null check (surcharge_cents >= 0),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  source text not null default 'director_paypal' check (source = 'director_paypal'),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index allcounty_meal_payments_signup on public.allcounty_meal_payments (signup_id);

alter table public.allcounty_meal_payments enable row level security;
revoke all privileges on table public.allcounty_meal_payments from anon, authenticated;
grant all on table public.allcounty_meal_payments to service_role;

comment on table public.allcounty_meal_payments is
  'Source: director PayPal payment of an All-County meals invoice (#221). meal_cents counts toward the invoice; surcharge_cents covers the PayPal fee. Service role only.';
