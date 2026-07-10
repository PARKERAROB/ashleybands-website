-- Touched-by-family signal (placement-authority-2026-27, phase 0 build step 3).
--
-- Phase 0 found the raw material already exists (portal_magic_links consumed
-- logins, portal_update_requests parent-submitted edits, portal_contact_methods
-- rows sourced from a family-facing flow) but no per-record touched/never-touched
-- flag is computed anywhere -- see provenance-lane-map.md §2 + §4.2.
--
-- Shape: two plain nullable columns for a future STAMPED event (set by app code
-- at the moment of a specific family action -- e.g. a portal confirm/edit),
-- plus a live-derived VIEW that answers "has this family ever touched this
-- record" from the existing tables today, with zero backfill required. The
-- view is the read path the admin UI + data-inventory page use now; the columns
-- are provisioned for a later write path that stamps a specific confirmation
-- moment. Both are useful; they are not the same signal and should not be
-- conflated.

alter table portal_students
  add column if not exists family_confirmed_at timestamptz;

alter table portal_people
  add column if not exists last_family_activity_at timestamptz;

comment on column portal_students.family_confirmed_at is
  'Stamped when a guardian explicitly confirms this student''s profile (future write path). NULL does not mean never-touched -- see portal_family_touch for the derived signal.';
comment on column portal_people.last_family_activity_at is
  'Stamped on a specific family action tied to this person (future write path). NULL does not mean never-touched -- see portal_person_family_touch for the derived signal.';

-- ============ Derived signal: has a family ever touched this record? ============
--
-- "Touched" = at least one of:
--   1. a consumed (logged-in) magic link tied to a contact method owned by a
--      person linked to the student/person,
--   2. a portal_update_requests row submitted for the student,
--   3. a portal_contact_methods row whose source shows the family supplied it
--      themselves (manual staff entry on the family's behalf, or a
--      family-facing intake route), as opposed to the bulk CSV sync.
--
-- Family-supplied contact sources seen in the app today: 'manual',
-- 'portal_access_request', 'portal_self_add'. Matched with a LIKE on 'portal_%'
-- too, so a new family-facing route that adds a fresh source tag is covered
-- without another migration.

create or replace view portal_student_family_touch as
with magic_touch as (
  select sp.student_id, ml.consumed_at as touched_at, 'magic_link_login' as touch_kind
  from portal_magic_links ml
  join portal_contact_methods cm on cm.id = ml.contact_method_id
  join portal_student_people sp on sp.person_id = cm.person_id
  where ml.consumed_at is not null
),
update_touch as (
  select ur.student_id, ur.submitted_at as touched_at, 'update_request' as touch_kind
  from portal_update_requests ur
  where ur.student_id is not null
),
contact_touch as (
  select sp.student_id, cm.updated_at as touched_at, 'family_contact_method' as touch_kind
  from portal_contact_methods cm
  join portal_student_people sp on sp.person_id = cm.person_id
  where cm.source in ('manual', 'portal_access_request', 'portal_self_add', 'portal_request')
     or cm.source like 'portal_%'
),
combined as (
  select * from magic_touch
  union all
  select * from update_touch
  union all
  select * from contact_touch
)
select
  s.id as student_id,
  s.source_student_id,
  s.display_name,
  bool_or(c.student_id is not null) as touched_by_family,
  max(c.touched_at) as last_touch_at,
  array_remove(array_agg(distinct c.touch_kind), null) as touch_kinds
from portal_students s
left join combined c on c.student_id = s.id
group by s.id, s.source_student_id, s.display_name;

comment on view portal_student_family_touch is
  'Live-derived (not stored): has ANY family member ever logged in, submitted an update, or self-supplied a contact method for this student. See 0028 migration comment for the exact signal definition.';

-- Same signal at the person level (a guardian who has ever logged in or
-- self-supplied a contact method, independent of which student they''re linked to).

create or replace view portal_person_family_touch as
with magic_touch as (
  select cm.person_id, ml.consumed_at as touched_at
  from portal_magic_links ml
  join portal_contact_methods cm on cm.id = ml.contact_method_id
  where ml.consumed_at is not null
),
update_touch as (
  select ur.submitted_by_person_id as person_id, ur.submitted_at as touched_at
  from portal_update_requests ur
  where ur.submitted_by_person_id is not null
),
contact_touch as (
  select cm.person_id, cm.updated_at as touched_at
  from portal_contact_methods cm
  where cm.source in ('manual', 'portal_access_request', 'portal_self_add', 'portal_request')
     or cm.source like 'portal_%'
),
combined as (
  select * from magic_touch
  union all
  select * from update_touch
  union all
  select * from contact_touch
)
select
  p.id as person_id,
  p.display_name,
  bool_or(c.person_id is not null) as touched_by_family,
  max(c.touched_at) as last_touch_at
from portal_people p
left join combined c on c.person_id = p.id
group by p.id, p.display_name;

comment on view portal_person_family_touch is
  'Live-derived (not stored) person-level counterpart to portal_student_family_touch.';
