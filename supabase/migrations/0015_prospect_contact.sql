-- Family sponsorship prospects: capture how to actually reach the business.
-- Before this, prospects held only business name + contact person + a relationship
-- note, with no way to email/call/visit the contact. Additive + safe.

alter table public.prospects
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists business_address text;
