-- Issue #213: enable the two remaining marching competitions for attendance.
-- provenance: staff_configuration, matching ATTENDANCE_EVENT_GROUP_CODES in lib/attendanceEvents.mjs.
insert into public.attendance_calendar_groups (
  calendar_event_id, group_id, source, source_reference
)
select mapping.calendar_event_id, groups.id, 'staff_configuration', mapping.source_reference
from (
  values
    ('evt-0017', 'marching-band-2026', 'Pirate Classic competition'),
    ('evt-0021', 'marching-band-2026', 'Pirate Nation competition')
) as mapping(calendar_event_id, group_code, source_reference)
join public.program_groups groups on groups.code = mapping.group_code
on conflict (calendar_event_id, group_id) do update set
  source = excluded.source,
  source_reference = excluded.source_reference,
  updated_at = now();
