-- #188: one shared opt-out list. Every email send drops an address found here
-- (lib/contactSuppression.js, called by resolveAudience and the single Resend call).
-- provenance: rows are upserted from the private contacts graph's do_not_contact entries by a
-- private sync script (source = 'contacts_graph', source_ref = the private record id), or added
-- by staff (source = 'staff'). No family-facing write path.
-- Private: RLS on, no anon/authenticated privileges (service role only).
create table public.contact_suppressions (
  id uuid primary key default gen_random_uuid(),
  contact_type text not null default 'email' check (contact_type in ('email', 'phone')),
  value_normalized text not null check (value_normalized <> '' and value_normalized = lower(btrim(value_normalized))),
  reason text not null default 'opted_out',
  source text not null check (source in ('contacts_graph', 'staff')),
  source_ref text not null default '',
  created_at timestamptz not null default now(),
  unique (contact_type, value_normalized)
);

alter table public.contact_suppressions enable row level security;
revoke all privileges on table public.contact_suppressions from anon, authenticated;
grant all on table public.contact_suppressions to service_role;

comment on table public.contact_suppressions is
  'Opt-out list checked before every email send (#188). Source: private contacts graph do_not_contact, or staff. Service role only.';
