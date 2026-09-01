-- Allow the field attendance tool to preserve a roster snapshot when a leader
-- opens the scheduled session through the shared attendance PIN.
-- provenance: roster_certification_source records whether the snapshot was
-- prepared by a named staff account or through the audited shared PIN gate.

alter table public.attendance_events
  add column if not exists roster_certification_source text;

update public.attendance_events
set roster_certification_source = case
  when roster_certified_by_staff_id is not null then 'named_staff'
  else 'shared_pin'
end
where roster_certification_state = 'certified'
  and roster_certification_source is null;

create or replace function public.set_attendance_roster_certification_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.roster_certification_state = 'certified' then
    new.roster_certification_source = case
      when new.roster_certified_by_staff_id is not null then 'named_staff'
      else 'shared_pin'
    end;
  else
    new.roster_certification_source = null;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_events_certification_source
  on public.attendance_events;
create trigger attendance_events_certification_source
before insert or update of roster_certification_state, roster_certified_by_staff_id
on public.attendance_events
for each row execute function public.set_attendance_roster_certification_source();

alter table public.attendance_events
  drop constraint if exists attendance_events_roster_certification_source_check,
  add constraint attendance_events_roster_certification_source_check check (
    roster_certification_source is null
    or roster_certification_source in ('named_staff', 'shared_pin')
  ),
  drop constraint if exists attendance_events_roster_certification_check,
  add constraint attendance_events_roster_certification_check check (
    (roster_certification_state = 'certified'
      and roster_certified_at is not null
      and (
        (roster_certification_source = 'named_staff'
          and roster_certified_by_staff_id is not null)
        or (roster_certification_source = 'shared_pin'
          and roster_certified_by_staff_id is null)
      ))
    or (roster_certification_state <> 'certified'
      and roster_certified_at is null
      and roster_certification_source is null)
  );

revoke all on function public.set_attendance_roster_certification_source()
  from public, anon, authenticated;
grant execute on function public.set_attendance_roster_certification_source()
  to service_role;
