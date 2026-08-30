-- Close direct browser access to private operational records.
--
-- All intended reads and writes for these tables already pass through server
-- routes using the service role. No family or staff client should query these
-- tables directly with the public or authenticated browser roles.

alter table public.instrument_inventory enable row level security;
alter table public.music_library_inventory enable row level security;
alter table public.portal_instrument_requests enable row level security;
alter table public.portal_clothing_orders enable row level security;
alter table public.portal_clothing_order_items enable row level security;

revoke all privileges on table public.instrument_inventory from anon, authenticated;
revoke all privileges on table public.music_library_inventory from anon, authenticated;
revoke all privileges on table public.portal_instrument_requests from anon, authenticated;
revoke all privileges on table public.portal_clothing_orders from anon, authenticated;
revoke all privileges on table public.portal_clothing_order_items from anon, authenticated;

comment on table public.portal_instrument_requests is
  'Private family instrument agreements. Access is only through audited server routes.';

comment on table public.portal_clothing_orders is
  'Private family clothing orders. Access is only through audited server routes.';

comment on table public.portal_clothing_order_items is
  'Private clothing order line items. Access is only through audited server routes.';
