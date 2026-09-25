-- Fix the first accept of an Infinite Campus register (#119).
-- In a SELECT DISTINCT, an untyped NULL resolves to text before the insert coerces it, so
-- student_class_enrollments.ends_on (date) rejected it: "column ends_on is of type date but
-- expression is of type text". The function is re-created unchanged except for null::date.

create or replace function public.accept_school_attendance_import(
  p_payload jsonb,
  p_actor_staff_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import_id uuid;
  v_existing_id uuid;
  v_school_year text;
  v_period_start date;
  v_period_end date;
  v_through_date date;
  v_latest_explicit_mark_date date;
  v_generated_at timestamptz;
  v_current_section_count integer;
begin
  if coalesce(p_payload->>'file_hash', '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid attendance register checksum' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'sections', '[]'::jsonb)) = 0
    or jsonb_array_length(coalesce(p_payload->'roster', '[]'::jsonb)) = 0 then
    raise exception 'Attendance register has no complete sections or matched roster rows' using errcode = '22023';
  end if;

  v_school_year := coalesce(nullif(trim(p_payload->>'school_year'), ''), 'Unknown');
  v_period_start := (p_payload->>'period_start')::date;
  v_period_end := (p_payload->>'period_end')::date;
  v_through_date := nullif(p_payload->>'through_date', '')::date;
  v_latest_explicit_mark_date := nullif(p_payload->>'latest_explicit_mark_date', '')::date;
  v_generated_at := (p_payload->>'generated_at')::timestamptz;

  insert into public.school_attendance_imports (
    file_hash, parser_version, generated_local, generated_at, period_start, period_end,
    through_date, latest_explicit_mark_date, term, schedule, school_year, page_count,
    section_count, roster_row_count, mark_count, issue_count, accepted_by_staff_id
  ) values (
    p_payload->>'file_hash', p_payload->>'parser_version', p_payload->>'generated_local',
    v_generated_at, v_period_start, v_period_end, v_through_date,
    v_latest_explicit_mark_date, nullif(p_payload->>'term', ''),
    nullif(p_payload->>'schedule', ''), v_school_year,
    (p_payload->>'page_count')::integer,
    jsonb_array_length(coalesce(p_payload->'sections', '[]'::jsonb)),
    jsonb_array_length(coalesce(p_payload->'roster', '[]'::jsonb)),
    jsonb_array_length(coalesce(p_payload->'marks', '[]'::jsonb)),
    jsonb_array_length(coalesce(p_payload->'issues', '[]'::jsonb)),
    p_actor_staff_id
  ) on conflict (file_hash) do nothing
  returning id into v_import_id;

  if v_import_id is null then
    select id into v_existing_id from public.school_attendance_imports
    where file_hash = p_payload->>'file_hash';
    return jsonb_build_object('importId', v_existing_id, 'alreadyAccepted', true);
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_payload->'roster', '[]'::jsonb))
      as row_data(source_student_hash text, portal_student_id uuid)
    group by row_data.source_student_hash
    having count(distinct row_data.portal_student_id) > 1
  ) or exists (
    select 1
    from jsonb_to_recordset(coalesce(p_payload->'roster', '[]'::jsonb))
      as row_data(source_student_hash text, portal_student_id uuid)
    group by row_data.portal_student_id
    having count(distinct row_data.source_student_hash) > 1
  ) or exists (
    select 1
    from jsonb_to_recordset(coalesce(p_payload->'roster', '[]'::jsonb))
      as row_data(source_section_code text, portal_student_id uuid)
    group by row_data.source_section_code, row_data.portal_student_id
    having count(*) > 1
  ) then
    raise exception 'Attendance register student mappings are not one-to-one' using errcode = '23505';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_payload->'roster', '[]'::jsonb))
      as row_data(source_student_hash text, portal_student_id uuid)
    join public.portal_student_external_identifiers identifier
      on identifier.authority = 'NHCS'
      and identifier.identifier_type = 'student_number'
      and ((identifier.identifier_hash = row_data.source_student_hash
          and identifier.student_id <> row_data.portal_student_id)
        or (identifier.student_id = row_data.portal_student_id
          and identifier.identifier_hash <> row_data.source_student_hash))
  ) then
    raise exception 'A protected student identifier is already connected differently'
      using errcode = '23505';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_school_year || ':' || section_data.source_section_code, 0
  ))
  from jsonb_to_recordset(coalesce(p_payload->'sections', '[]'::jsonb))
    as section_data(source_section_code text)
  order by section_data.source_section_code;

  perform pg_advisory_xact_lock(hashtextextended(identity_lock.lock_key, 0))
  from (
    select 'nhcs-hash:' || row_data.source_student_hash as lock_key
    from jsonb_to_recordset(coalesce(p_payload->'roster', '[]'::jsonb))
      as row_data(source_student_hash text)
    union
    select 'nhcs-student:' || row_data.portal_student_id::text as lock_key
    from jsonb_to_recordset(coalesce(p_payload->'roster', '[]'::jsonb))
      as row_data(portal_student_id uuid)
  ) identity_lock
  order by identity_lock.lock_key;

  insert into public.portal_student_external_identifiers (
    student_id, authority, identifier_type, identifier_hash, identifier_last4,
    verification_source, verified_at, verified_by_staff_id
  )
  select distinct roster_data.portal_student_id, 'NHCS', 'student_number',
    roster_data.source_student_hash, roster_data.source_student_last4,
    'school_attendance_import:' || v_import_id::text, now(), p_actor_staff_id
  from jsonb_to_recordset(coalesce(p_payload->'roster', '[]'::jsonb))
    as roster_data(
      source_student_hash text, source_student_last4 text, portal_student_id uuid
    )
  on conflict do nothing;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_payload->'roster', '[]'::jsonb))
      as row_data(source_student_hash text, portal_student_id uuid)
    left join public.portal_student_external_identifiers identifier
      on identifier.authority = 'NHCS'
      and identifier.identifier_type = 'student_number'
      and identifier.identifier_hash = row_data.source_student_hash
      and identifier.student_id = row_data.portal_student_id
    where identifier.id is null
  ) then
    raise exception 'A protected student identifier was connected concurrently to a different student'
      using errcode = '23505';
  end if;

  create temporary table incoming_school_sections (
    sequence integer,
    source_section_code text primary key,
    name text,
    source_complete boolean,
    prior_section_id uuid,
    is_current boolean not null
  ) on commit drop;

  insert into incoming_school_sections (
    sequence, source_section_code, name, source_complete, prior_section_id, is_current
  )
  select section_data.sequence,
    section_data.source_section_code,
    section_data.name,
    coalesce(section_data.source_complete, false),
    prior.id,
    prior.id is null
      or coalesce(v_through_date, v_period_start) > prior.source_through_date
      or (coalesce(v_through_date, v_period_start) = prior.source_through_date
        and v_generated_at > prior.source_generated_at)
  from jsonb_to_recordset(coalesce(p_payload->'sections', '[]'::jsonb))
    as section_data(sequence integer, source_section_code text, name text, source_complete boolean)
  left join public.school_attendance_import_sections prior
    on prior.school_year = v_school_year
    and prior.source_section_code = section_data.source_section_code
    and prior.status = 'current';

  if exists (select 1 from incoming_school_sections where not source_complete) then
    raise exception 'Only complete class sections can be accepted' using errcode = '22023';
  end if;

  update public.school_attendance_import_sections prior
  set status = 'superseded'
  from incoming_school_sections incoming
  where incoming.is_current and incoming.prior_section_id = prior.id;

  insert into public.school_class_sections (
    code, name, section_code, school_year, term, status, starts_on, ends_on,
    source, source_reference, last_synced_at
  )
  select
    'ic-' || lower(regexp_replace(left(v_school_year, 5), '[^0-9a-z]+', '-', 'g'))
      || '-' || lower(regexp_replace(incoming.source_section_code, '[^0-9a-z]+', '-', 'g')),
    incoming.name, incoming.source_section_code, left(v_school_year, 5),
    nullif(p_payload->>'term', ''), 'active', v_period_start, null,
    'infinite_campus_attendance_register', 'school_attendance_import:' || v_import_id::text, now()
  from incoming_school_sections incoming
  where incoming.is_current
  on conflict (code) do update set
    name = excluded.name, section_code = excluded.section_code, term = excluded.term,
    status = 'active', ends_on = null, source = excluded.source,
    source_reference = excluded.source_reference, last_synced_at = excluded.last_synced_at,
    updated_at = now();

  insert into public.school_attendance_import_sections (
    import_id, sequence, source_section_code, name, school_year, source_generated_at,
    source_through_date,
    source_complete, status, supersedes_import_section_id, linked_section_id
  )
  select v_import_id, incoming.sequence, incoming.source_section_code, incoming.name,
    v_school_year, v_generated_at, coalesce(v_through_date, v_period_start), incoming.source_complete,
    case when incoming.is_current then 'current' else 'superseded' end,
    case when incoming.is_current then incoming.prior_section_id else null end,
    class_section.id
  from incoming_school_sections incoming
  join public.school_class_sections class_section
    on class_section.code = 'ic-' || lower(regexp_replace(left(v_school_year, 5), '[^0-9a-z]+', '-', 'g'))
      || '-' || lower(regexp_replace(incoming.source_section_code, '[^0-9a-z]+', '-', 'g'));

  select count(*) into v_current_section_count
  from incoming_school_sections where is_current;
  if v_current_section_count = 0 then
    update public.school_attendance_imports set status = 'superseded' where id = v_import_id;
  end if;

  insert into public.school_attendance_import_roster (
    import_id, source_student_hash, source_student_last4, source_student_name,
    source_section_code, portal_student_id, match_method, source_page
  )
  select v_import_id, roster_data.source_student_hash, roster_data.source_student_last4,
    roster_data.source_student_name, roster_data.source_section_code,
    roster_data.portal_student_id, roster_data.match_method, roster_data.source_page
  from jsonb_to_recordset(coalesce(p_payload->'roster', '[]'::jsonb))
    as roster_data(
      source_student_hash text, source_student_last4 text, source_student_name text,
      source_section_code text, portal_student_id uuid, match_method text, source_page integer
    );

  insert into public.school_attendance_import_dates (import_id, attendance_date, source_column)
  select v_import_id, date_data.attendance_date, date_data.source_column
  from jsonb_to_recordset(coalesce(p_payload->'dates', '[]'::jsonb))
    as date_data(attendance_date date, source_column integer);

  insert into public.school_attendance_marks (
    import_id, source_student_hash, source_section_code, portal_student_id,
    attendance_date, code, meaning, source_page, source_column
  )
  select v_import_id, mark_data.source_student_hash, mark_data.source_section_code,
    mark_data.portal_student_id, mark_data.attendance_date, mark_data.code,
    mark_data.meaning, mark_data.source_page, mark_data.source_column
  from jsonb_to_recordset(coalesce(p_payload->'marks', '[]'::jsonb))
    as mark_data(
      source_student_hash text, source_section_code text, portal_student_id uuid,
      attendance_date date, code text, meaning text, source_page integer, source_column integer
    );

  insert into public.school_attendance_import_issues (
    import_id, issue_kind, detail, source_page, source_section_code, attendance_date, source_code
  )
  select v_import_id, issue_data.issue_kind, issue_data.detail, issue_data.source_page,
    issue_data.source_section_code, issue_data.attendance_date, issue_data.source_code
  from jsonb_to_recordset(coalesce(p_payload->'issues', '[]'::jsonb))
    as issue_data(
      issue_kind text, detail text, source_page integer, source_section_code text,
      attendance_date date, source_code text
    );

  update public.student_class_enrollments enrollment
  set ends_on = coalesce(v_through_date, v_period_start), last_synced_at = now(), updated_at = now()
  from public.school_attendance_import_sections import_section
  where import_section.import_id = v_import_id
    and import_section.status = 'current'
    and import_section.source_complete
    and enrollment.section_id = import_section.linked_section_id
    and enrollment.ends_on is null
    and enrollment.source = 'infinite_campus_attendance_register'
    and not exists (
      select 1 from public.school_attendance_import_roster import_roster
      where import_roster.import_id = v_import_id
        and import_roster.source_section_code = import_section.source_section_code
        and import_roster.portal_student_id = enrollment.student_id
    );

  insert into public.student_class_enrollments (
    section_id, student_id, starts_on, ends_on, source, source_reference, last_synced_at
  )
  select distinct import_section.linked_section_id, import_roster.portal_student_id,
    case
      when exists (
        select 1
        from public.student_class_enrollments prior_enrollment
        where prior_enrollment.section_id = import_section.linked_section_id
          and prior_enrollment.student_id = import_roster.portal_student_id
          and prior_enrollment.ends_on is not null
      ) then greatest(
        (v_generated_at at time zone 'America/New_York')::date,
        (
          select max(prior_enrollment.ends_on) + 1
          from public.student_class_enrollments prior_enrollment
          where prior_enrollment.section_id = import_section.linked_section_id
            and prior_enrollment.student_id = import_roster.portal_student_id
            and prior_enrollment.ends_on is not null
        )
      )
      else v_period_start
    end,
    null::date, 'infinite_campus_attendance_register',
    'school_attendance_import:' || v_import_id::text, now()
  from public.school_attendance_import_roster import_roster
  join public.school_attendance_import_sections import_section
    on import_section.import_id = import_roster.import_id
    and import_section.source_section_code = import_roster.source_section_code
  where import_roster.import_id = v_import_id
    and import_section.status = 'current'
    and import_section.source_complete
  on conflict (section_id, student_id) where ends_on is null do update set
    source = excluded.source, source_reference = excluded.source_reference,
    last_synced_at = excluded.last_synced_at, updated_at = now();

  return jsonb_build_object(
    'importId', v_import_id, 'alreadyAccepted', false,
    'currentSectionCount', v_current_section_count,
    'sectionCount', jsonb_array_length(coalesce(p_payload->'sections', '[]'::jsonb)),
    'rosterRowCount', jsonb_array_length(coalesce(p_payload->'roster', '[]'::jsonb)),
    'markCount', jsonb_array_length(coalesce(p_payload->'marks', '[]'::jsonb))
  );
end;
$$;
revoke all on function public.accept_school_attendance_import(jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.accept_school_attendance_import(jsonb,uuid)
  to service_role;
