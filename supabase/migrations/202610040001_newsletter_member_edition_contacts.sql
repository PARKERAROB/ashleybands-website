-- Staff Rob names can receive the member edition without a student link (#173).
-- provenance: set by staff on Rob's direction; newsletter_contacts.source records the origin.
alter table newsletter_contacts
  add column if not exists member_edition_opt_in boolean not null default false;
