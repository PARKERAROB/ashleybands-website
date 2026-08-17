create table if not exists portal_clothing_orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete restrict,
  submitted_by_person_id uuid not null references portal_people(id) on delete restrict,
  collection_key text not null default 'open_house_2026',
  source text not null default 'portal_family',
  subtotal_cents int not null check (subtotal_cents >= 0),
  tax_rate numeric(6,5) not null default 0.07,
  tax_cents int not null check (tax_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  paypal_order_id text unique,
  paypal_capture_id text,
  paid_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_clothing_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references portal_clothing_orders(id) on delete cascade,
  product_key text not null,
  source text not null default 'portal_family',
  product_name text not null,
  color text not null,
  size text not null,
  quantity int not null check (quantity between 1 and 20),
  unit_price_cents int not null check (unit_price_cents > 0)
);

create index if not exists portal_clothing_orders_student_idx on portal_clothing_orders(student_id, submitted_at);
create index if not exists portal_clothing_orders_payment_idx on portal_clothing_orders(payment_status, submitted_at);
