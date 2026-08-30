-- AshleyBands Weekly: public archive, current-program delivery, and confirmed community opt-in.
-- provenance: newsletter issue copy is entered by authenticated Ashley Bands staff; community email
-- addresses come from the public newsletter signup form; current-program recipients are resolved from
-- the existing active portal roster at send time.

create table if not exists newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  issue_date date not null unique,
  week_start date not null,
  week_end date not null,
  title text not null,
  preview_text text not null default '',
  public_subject text not null,
  member_subject text not null,
  public_markdown text not null,
  member_markdown text not null,
  review_notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by text not null default '',
  updated_by text not null default '',
  source text not null default 'staff_newsletter_editor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (week_end >= week_start)
);

create table if not exists newsletter_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  community_opt_in boolean not null default false,
  newsletter_opted_out boolean not null default false,
  confirm_token uuid,
  confirm_expires_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  confirmed_at timestamptz,
  opted_out_at timestamptz,
  program_seen_at timestamptz,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table broadcasts
  add column if not exists newsletter_issue_id uuid references newsletter_issues(id) on delete set null,
  add column if not exists newsletter_edition text check (newsletter_edition in ('member', 'public'));

create index if not exists newsletter_issues_public_idx
  on newsletter_issues(status, issue_date desc);
create index if not exists newsletter_contacts_delivery_idx
  on newsletter_contacts(community_opt_in, newsletter_opted_out);
create unique index if not exists broadcasts_newsletter_issue_edition_uidx
  on broadcasts(newsletter_issue_id, newsletter_edition)
  where newsletter_issue_id is not null and newsletter_edition is not null;

alter table newsletter_issues enable row level security;
alter table newsletter_contacts enable row level security;

drop trigger if exists newsletter_issues_updated_at on newsletter_issues;
create trigger newsletter_issues_updated_at
  before update on newsletter_issues
  for each row execute function set_updated_at();

drop trigger if exists newsletter_contacts_updated_at on newsletter_contacts;
create trigger newsletter_contacts_updated_at
  before update on newsletter_contacts
  for each row execute function set_updated_at();

comment on table newsletter_issues is
  'Staff-authored AshleyBands Weekly issues. Only published public_markdown is exposed by the server-rendered public archive.';
comment on table newsletter_contacts is
  'Newsletter-only contact preferences. Active-program eligibility remains derived from portal_students and trusted contact relationships at send time.';
comment on column newsletter_contacts.email is
  'Lowercase delivery email from a confirmed community signup or the active-program audience resolver.';
comment on column newsletter_contacts.source is
  'Provenance for the most recent contact-list entry path, such as community_signup or active_program.';
comment on column newsletter_contacts.newsletter_opted_out is
  'Suppresses AshleyBands Weekly only. It does not suppress urgent or transactional program messages.';

insert into newsletter_issues (
  slug,
  issue_date,
  week_start,
  week_end,
  title,
  preview_text,
  public_subject,
  member_subject,
  public_markdown,
  member_markdown,
  review_notes,
  status,
  created_by,
  updated_by,
  source
) values (
  '2026-08-30',
  '2026-08-30',
  '2026-08-31',
  '2026-09-06',
  'A strong first week',
  'What Ashley Bands accomplished and what is coming this week.',
  'AshleyBands Weekly | August 30-September 5',
  'AshleyBands Weekly | August 30-September 5',
  $public$
Ashley Bands completed a strong first week of classes and our first Friday night of the season. Students are already connecting fundamentals to real music, and both concert ensembles received news of an important opportunity ahead.

## This week at a glance

- **Tuesday, September 1:** Carnegie Hall information meeting, 6:30-7:30 p.m.
- **Thursday, September 3:** Marching Band rehearsal, 4:00-7:00 p.m.
- **Through September 9:** Perry's Gourmet Popcorn fundraiser continues.

## What students accomplished

- Concert Band began producing a rich ensemble sound while connecting music-reading fundamentals to repertoire.
- Percussion Ensemble played an F-major scale and showed significant potential as the class began establishing its daily routines.
- Wind Ensemble made *Bernstein Tribute* playable, developed the ragtime style in *The Entertainer*, and successfully sight-read *Cinnetaf*.
- Marching Band continued working after rain shortened Thursday's field block. Sets 33-39 improved substantially in both music and drill understanding.

## Carnegie Hall information meeting

Ashley Concert Band and Wind Ensemble received official festival acceptances. Tuesday's meeting will explain the opportunity, projected costs, fundraising, participation expectations, and next steps. The meeting is informational. No registration, payment, or family commitment is due that evening.

## Friday night

The Screaming Eagle Regiment completed its first home football game of the season on Friday. We will continue building from that first performance as the season moves forward.

## Stay connected

- [Subscribe to the Ashley Bands calendar](https://ashleybands.com/calendar)
- [Open the Family Portal](https://ashleybands.com/portal)
- [Support Ashley Bands](https://ashleybands.com/sponsors)
  $public$,
  $member$
Ashley Bands completed a strong first week of classes and our first Friday night of the season. Students are already connecting fundamentals to real music, and both concert ensembles received news of an important opportunity ahead.

## This week at a glance

- **Tuesday, September 1:** Marching Band rehearsal, 4:00-6:30 p.m.
- **Tuesday, September 1:** Carnegie Hall information meeting, 6:30-7:30 p.m.
- **Thursday, September 3:** Marching Band rehearsal, 4:00-7:00 p.m.
- **Through September 9:** Perry's Gourmet Popcorn fundraiser continues.

## What students accomplished

- Concert Band began producing a rich ensemble sound while connecting music-reading fundamentals to repertoire.
- Percussion Ensemble played an F-major scale and showed significant potential as the class began establishing its daily routines.
- Wind Ensemble made *Bernstein Tribute* playable, developed the ragtime style in *The Entertainer*, and successfully sight-read *Cinnetaf*.
- Marching Band continued working after rain shortened Thursday's field block. Sets 33-39 improved substantially in both music and drill understanding.

## Carnegie Hall information meeting

Ashley Concert Band and Wind Ensemble received official festival acceptances. Tuesday's meeting will explain the opportunity, projected costs, fundraising, participation expectations, and next steps. The meeting is informational. No registration, payment, or family commitment is due that evening.

## Students

- Check Canvas for the current 50 Progressive Exercises assignment and your teacher's posted due date.
- Marching students should have music, water, and everything needed for Tuesday and Thursday rehearsal.
- Use the stronger work in sets 33-39 as the standard while earlier sections of the show are cleaned.

## Families

- Subscribe to the [Ashley Bands calendar](https://ashleybands.com/calendar) so date and time changes update automatically.
- Review your family information in the [Family Portal](https://ashleybands.com/portal).
- Perry's Gourmet Popcorn remains open through September 9. Please continue using the seller-note instructions from the August 26 family message.

## Friday night

The Screaming Eagle Regiment completed its first home football game of the season on Friday. We will continue building from that first performance as the season moves forward.
  $member$,
  'Before publishing: confirm the September 1 room and online-participation details; add one verified Friday-night outcome and an approved photo if available; confirm the current Canvas assignment wording and due date; decide whether the new student sponsorship Share link should wait until the Perry campaign ends.',
  'draft',
  'Rob Parker build authorization 2026-08-30',
  'Rob Parker build authorization 2026-08-30',
  'current AshleyBands records reviewed 2026-08-30'
)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
