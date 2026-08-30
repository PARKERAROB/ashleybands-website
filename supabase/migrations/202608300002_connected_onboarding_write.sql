-- Transactional, idempotent writes for the connected onboarding form.
-- provenance: accepted AshleyBands onboarding workflow; each step writes only
-- its owning records and records an audit receipt without raw contact data.

create or replace function portal_save_onboarding_step(
  p_actor_person_id uuid,
  p_student_id uuid,
  p_form_version text,
  p_step_number int,
  p_payload jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student portal_students%rowtype;
  v_actor_type text;
  v_actor_role text;
  v_assurance text;
  v_now timestamptz := now();
  v_student_person_id uuid;
  v_primary_instrument_id uuid;
  v_school_id uuid;
  v_guardian jsonb;
  v_guardian_id uuid;
  v_guardian_name text;
  v_guardian_relationship text;
  v_guardian_email text;
  v_guardian_phone text;
  v_guardian_index int := 0;
  v_relationship_status text;
  v_areas text[] := '{}';
  v_note text;
  v_shirt_size text;
  v_instrument_access text;
  v_expected_count int;
  v_actual_count int;
begin
  if p_step_number not between 1 and 6 then
    raise exception 'Invalid onboarding step' using errcode = '22023';
  end if;
  if p_form_version is null or length(trim(p_form_version)) = 0 then
    raise exception 'Missing onboarding form version' using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'Missing idempotency key' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  if exists (
    select 1 from portal_onboarding_step_receipts receipt
    where receipt.idempotency_key = p_idempotency_key
      and receipt.student_id = p_student_id
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'step', p_step_number);
  end if;

  select people.person_type, relationship.role, relationship.assurance_level
  into v_actor_type, v_actor_role, v_assurance
  from portal_student_people relationship
  join portal_people people on people.id = relationship.person_id
  where relationship.person_id = p_actor_person_id
    and relationship.student_id = p_student_id
    and relationship.relationship_status = 'trusted'
    and relationship.assurance_level in ('medium', 'high')
  limit 1;

  if not found then
    raise exception 'Strongly verified student relationship required' using errcode = '42501';
  end if;

  select * into v_student
  from portal_students student
  where student.id = p_student_id
    and lower(coalesce(student.status, '')) = 'active'
  for update;
  if not found then
    raise exception 'Active student not found' using errcode = '42501';
  end if;

  if p_step_number = 1 then
    update portal_students
    set
      preferred_first = nullif(left(trim(coalesce(p_payload->>'preferredFirst', '')), 120), ''),
      display_name = concat_ws(
        ' ',
        coalesce(nullif(left(trim(coalesce(p_payload->>'preferredFirst', '')), 120), ''), legal_first),
        legal_last
      ),
      updated_at = v_now
    where id = p_student_id;

    insert into portal_student_profiles (
      student_id, name_pronunciation, pronouns, source, updated_by_person_id, updated_at
    ) values (
      p_student_id,
      nullif(left(trim(coalesce(p_payload->>'pronunciation', '')), 160), ''),
      nullif(left(trim(coalesce(p_payload->>'pronouns', '')), 80), ''),
      'portal_onboarding', p_actor_person_id, v_now
    )
    on conflict (student_id) do update set
      name_pronunciation = excluded.name_pronunciation,
      pronouns = excluded.pronouns,
      source = excluded.source,
      updated_by_person_id = excluded.updated_by_person_id,
      updated_at = excluded.updated_at;

  elsif p_step_number = 2 then
    select relationship.person_id into v_student_person_id
    from portal_student_people relationship
    join portal_people people on people.id = relationship.person_id
    where relationship.student_id = p_student_id
      and people.person_type = 'student'
      and relationship.relationship_status not in ('rejected', 'superseded')
    order by (relationship.role = 'student') desc, relationship.created_at
    limit 1;

    if v_student_person_id is null then
      insert into portal_people (
        source_person_key, person_type, display_name, first_name, last_name, source, source_row_hash
      ) values (
        'portal-student:' || v_student.source_student_id,
        'student', v_student.display_name, v_student.legal_first, v_student.legal_last,
        'portal_onboarding', v_student.source_student_id
      )
      on conflict (source_person_key) do update set
        display_name = excluded.display_name,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        updated_at = v_now
      returning id into v_student_person_id;

      insert into portal_student_people (
        student_id, person_id, role, relationship_status, source, source_row_hash,
        assurance_level, trust_source, assured_at, assured_by
      ) values (
        p_student_id, v_student_person_id, 'student', 'trusted', 'portal_onboarding',
        v_student.source_student_id, 'high', 'canonical_student_record', v_now, 'portal_onboarding'
      ) on conflict (student_id, person_id) do update set
        role = 'student', relationship_status = 'trusted', assurance_level = 'high',
        trust_source = 'canonical_student_record', assured_at = v_now, assured_by = 'portal_onboarding';
    end if;

    if nullif(trim(coalesce(v_student.school_email, '')), '') is not null then
      insert into portal_contact_methods (
        person_id, contact_type, value_display, value_normalized, contact_purpose,
        verification_status, verification_source, source, updated_at
      ) values (
        v_student_person_id, 'email', trim(v_student.school_email), lower(trim(v_student.school_email)),
        'school', 'unverified', 'official_school_record', 'portal_onboarding', v_now
      ) on conflict (person_id, contact_type, value_normalized) do update set
        value_display = excluded.value_display,
        contact_purpose = 'school',
        updated_at = excluded.updated_at;
    end if;

    update portal_contact_methods set verification_status = 'replaced', updated_at = v_now
    where person_id = v_student_person_id and contact_purpose = 'personal_backup'
      and value_normalized <> lower(trim(coalesce(p_payload->>'personalEmail', '')))
      and verification_status not in ('replaced', 'superseded');
    if nullif(trim(coalesce(p_payload->>'personalEmail', '')), '') is not null then
      if position('@' in trim(p_payload->>'personalEmail')) = 0 then
        raise exception 'Invalid personal email' using errcode = '22023';
      end if;
      insert into portal_contact_methods (
        person_id, contact_type, value_display, value_normalized, contact_purpose,
        verification_status, source, updated_at
      ) values (
        v_student_person_id, 'email', left(trim(p_payload->>'personalEmail'), 320),
        lower(left(trim(p_payload->>'personalEmail'), 320)), 'personal_backup',
        'unverified', 'portal_onboarding', v_now
      ) on conflict (person_id, contact_type, value_normalized) do update set
        value_display = excluded.value_display, contact_purpose = 'personal_backup',
        source = excluded.source, updated_at = excluded.updated_at;
    end if;

    update portal_contact_methods set verification_status = 'replaced', updated_at = v_now
    where person_id = v_student_person_id and contact_purpose = 'emergency_mobile'
      and value_normalized <> regexp_replace(trim(coalesce(p_payload->>'mobile', '')), '\D', '', 'g')
      and verification_status not in ('replaced', 'superseded');
    if nullif(trim(coalesce(p_payload->>'mobile', '')), '') is not null then
      insert into portal_contact_methods (
        person_id, contact_type, value_display, value_normalized, contact_purpose,
        verification_status, source, updated_at
      ) values (
        v_student_person_id, 'phone', left(trim(p_payload->>'mobile'), 80),
        regexp_replace(left(trim(p_payload->>'mobile'), 80), '\D', '', 'g'),
        'emergency_mobile', 'unverified', 'portal_onboarding', v_now
      ) on conflict (person_id, contact_type, value_normalized) do update set
        value_display = excluded.value_display, contact_purpose = 'emergency_mobile',
        source = excluded.source, updated_at = excluded.updated_at;
    end if;

  elsif p_step_number = 3 then
    if jsonb_typeof(coalesce(p_payload->'guardians', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(p_payload->'guardians', '[]'::jsonb)) not between 1 and 4 then
      raise exception 'One to four guardians are required' using errcode = '22023';
    end if;

    update portal_student_people relationship
    set primary_contact = false, emergency_contact = false, updated_at = v_now
    where relationship.student_id = p_student_id
      and relationship.relationship_status not in ('rejected', 'superseded')
      and exists (
        select 1 from portal_people people
        where people.id = relationship.person_id and people.person_type <> 'student'
      );

    v_relationship_status := case when v_actor_type = 'student' then 'claimed' else 'trusted' end;

    for v_guardian in select value from jsonb_array_elements(p_payload->'guardians')
    loop
      v_guardian_index := v_guardian_index + 1;
      v_guardian_name := nullif(left(trim(coalesce(v_guardian->>'name', '')), 200), '');
      v_guardian_relationship := nullif(left(trim(coalesce(v_guardian->>'relationship', '')), 120), '');
      v_guardian_email := lower(nullif(left(trim(coalesce(v_guardian->>'email', '')), 320), ''));
      v_guardian_phone := nullif(left(trim(coalesce(v_guardian->>'phone', '')), 80), '');
      if v_guardian_name is null or v_guardian_relationship is null
        or v_guardian_email is null or v_guardian_phone is null then
        if v_guardian_index = 1 then
          raise exception 'Guardian 1 is incomplete' using errcode = '22023';
        end if;
        continue;
      end if;
      if position('@' in v_guardian_email) = 0 then
        raise exception 'Invalid guardian email' using errcode = '22023';
      end if;

      v_guardian_id := null;
      if nullif(v_guardian->>'personId', '') is not null then
        select relationship.person_id into v_guardian_id
        from portal_student_people relationship
        join portal_people people on people.id = relationship.person_id
        where relationship.student_id = p_student_id
          and relationship.person_id = (v_guardian->>'personId')::uuid
          and people.person_type <> 'student'
          and relationship.relationship_status not in ('rejected', 'superseded')
        limit 1;
      end if;
      if v_guardian_id is null then
        select contact.person_id into v_guardian_id
        from portal_contact_methods contact
        join portal_people people on people.id = contact.person_id
        where contact.contact_type = 'email'
          and contact.value_normalized = v_guardian_email
          and contact.verification_status not in ('replaced', 'superseded', 'hard_bounce')
          and people.person_type <> 'student'
        order by contact.verified_at desc nulls last, contact.created_at
        limit 1;
      end if;
      if v_guardian_id is null then
        insert into portal_people (
          source_person_key, person_type, display_name, first_name, last_name, source, source_row_hash
        ) values (
          'portal-onboarding:' || p_student_id::text || ':' || md5(v_guardian_email),
          'guardian', v_guardian_name,
          regexp_replace(v_guardian_name, '\s+\S+$', ''),
          substring(v_guardian_name from '\S+$'),
          'portal_onboarding', p_idempotency_key::text
        )
        on conflict (source_person_key) do update set
          display_name = excluded.display_name,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          updated_at = v_now
        returning id into v_guardian_id;
      else
        update portal_people set display_name = v_guardian_name, updated_at = v_now
        where id = v_guardian_id;
      end if;

      insert into portal_student_people (
        student_id, person_id, role, relationship_status, primary_contact, emergency_contact,
        source, source_row_hash, assurance_level, trust_source, assured_at, assured_by
      ) values (
        p_student_id, v_guardian_id, v_guardian_relationship, v_relationship_status,
        v_guardian_index = 1, v_guardian_index = 1, 'portal_onboarding', p_idempotency_key::text,
        case when v_relationship_status = 'trusted' then 'medium' else 'legacy' end,
        case when v_relationship_status = 'trusted' then 'trusted_guardian_add' else 'student_supplied_contact' end,
        case when v_relationship_status = 'trusted' then v_now else null end,
        case when v_relationship_status = 'trusted' then p_actor_person_id::text else null end
      ) on conflict (student_id, person_id) do update set
        role = excluded.role,
        relationship_status = case
          when portal_student_people.relationship_status = 'trusted' then 'trusted'
          else excluded.relationship_status
        end,
        primary_contact = excluded.primary_contact,
        emergency_contact = excluded.emergency_contact,
        source = excluded.source,
        source_row_hash = excluded.source_row_hash,
        assurance_level = case
          when portal_student_people.assurance_level in ('medium', 'high') then portal_student_people.assurance_level
          else excluded.assurance_level
        end,
        trust_source = coalesce(portal_student_people.trust_source, excluded.trust_source),
        assured_at = coalesce(portal_student_people.assured_at, excluded.assured_at),
        assured_by = coalesce(portal_student_people.assured_by, excluded.assured_by),
        updated_at = v_now;

      insert into portal_contact_methods (
        person_id, contact_type, value_display, value_normalized, contact_purpose,
        verification_status, source, updated_at
      ) values (
        v_guardian_id, 'email', v_guardian_email, v_guardian_email, 'general',
        'unverified', 'portal_onboarding', v_now
      ) on conflict (person_id, contact_type, value_normalized) do update set
        value_display = excluded.value_display, source = excluded.source, updated_at = excluded.updated_at;

      insert into portal_contact_methods (
        person_id, contact_type, value_display, value_normalized, contact_purpose,
        verification_status, source, updated_at
      ) values (
        v_guardian_id, 'phone', v_guardian_phone,
        regexp_replace(v_guardian_phone, '\D', '', 'g'), 'general',
        'unverified', 'portal_onboarding', v_now
      ) on conflict (person_id, contact_type, value_normalized) do update set
        value_display = excluded.value_display, source = excluded.source, updated_at = excluded.updated_at;
    end loop;

  elsif p_step_number = 4 then
    if nullif(trim(coalesce(p_payload->>'primaryInstrument', '')), '') is null then
      raise exception 'Primary instrument is required' using errcode = '22023';
    end if;
    v_primary_instrument_id := null;
    if p_payload->>'primaryInstrument' <> 'None' then
      select id into v_primary_instrument_id from portal_instrument_types
      where name = p_payload->>'primaryInstrument' and active = true;
      if v_primary_instrument_id is null then
        raise exception 'Unknown primary instrument' using errcode = '22023';
      end if;
    end if;

    insert into portal_student_music_profiles (
      student_id, primary_instrument_id, primary_instrument_none, years_playing,
      source, updated_by_person_id, updated_at
    ) values (
      p_student_id, v_primary_instrument_id, p_payload->>'primaryInstrument' = 'None',
      nullif(left(trim(coalesce(p_payload->>'yearsPlaying', '')), 80), ''),
      'portal_onboarding', p_actor_person_id, v_now
    ) on conflict (student_id) do update set
      primary_instrument_id = excluded.primary_instrument_id,
      primary_instrument_none = excluded.primary_instrument_none,
      years_playing = excluded.years_playing,
      source = excluded.source,
      updated_by_person_id = excluded.updated_by_person_id,
      updated_at = excluded.updated_at;

    delete from portal_student_other_instruments where student_id = p_student_id;
    insert into portal_student_other_instruments (student_id, instrument_type_id, source)
    select p_student_id, directory.id, 'portal_onboarding'
    from jsonb_array_elements_text(coalesce(p_payload->'otherInstruments', '[]'::jsonb)) selected(name)
    join portal_instrument_types directory on directory.name = selected.name and directory.active = true
    where directory.id is distinct from v_primary_instrument_id
    on conflict do nothing;
    select jsonb_array_length(coalesce(p_payload->'otherInstruments', '[]'::jsonb)) into v_expected_count;
    select count(*) into v_actual_count
    from jsonb_array_elements_text(coalesce(p_payload->'otherInstruments', '[]'::jsonb)) selected(name)
    join portal_instrument_types directory on directory.name = selected.name and directory.active = true;
    if v_actual_count <> v_expected_count then
      raise exception 'Unknown other instrument' using errcode = '22023';
    end if;

    delete from portal_student_interests where student_id = p_student_id;
    insert into portal_student_interests (student_id, interest_type_id, source)
    select p_student_id, directory.id, 'portal_onboarding'
    from jsonb_array_elements_text(coalesce(p_payload->'interests', '[]'::jsonb)) selected(name)
    join portal_interest_types directory on directory.name = selected.name and directory.active = true
    on conflict do nothing;
    select jsonb_array_length(coalesce(p_payload->'interests', '[]'::jsonb)) into v_expected_count;
    select count(*) into v_actual_count
    from jsonb_array_elements_text(coalesce(p_payload->'interests', '[]'::jsonb)) selected(name)
    join portal_interest_types directory on directory.name = selected.name and directory.active = true;
    if v_actual_count <> v_expected_count then
      raise exception 'Unknown music interest' using errcode = '22023';
    end if;

    if nullif(trim(coalesce(p_payload->>'originSchool', '')), '') is null then
      raise exception 'Previous school is required' using errcode = '22023';
    end if;
    v_school_id := null;
    if p_payload->>'originSchool' not in ('outside_county', 'no_previous') then
      select id into v_school_id from portal_schools
      where code = p_payload->>'originSchool' and active = true;
      if v_school_id is null then
        raise exception 'Unknown previous school' using errcode = '22023';
      end if;
    end if;
    if p_payload->>'originSchool' = 'outside_county' and (
      nullif(trim(coalesce(p_payload->>'priorSchoolName', '')), '') is null
      or nullif(trim(coalesce(p_payload->>'priorSchoolCity', '')), '') is null
      or length(trim(coalesce(p_payload->>'priorSchoolState', ''))) <> 2
    ) then
      raise exception 'Outside-county school, city, and state are required' using errcode = '22023';
    end if;
    insert into portal_student_school_background (
      student_id, school_id, external_school_name, external_city, external_state,
      no_previous_music_program, source, updated_at
    ) values (
      p_student_id, v_school_id,
      case when p_payload->>'originSchool' = 'outside_county' then left(trim(p_payload->>'priorSchoolName'), 200) end,
      case when p_payload->>'originSchool' = 'outside_county' then left(trim(p_payload->>'priorSchoolCity'), 120) end,
      case when p_payload->>'originSchool' = 'outside_county' then upper(trim(p_payload->>'priorSchoolState')) end,
      p_payload->>'originSchool' = 'no_previous', 'portal_onboarding', v_now
    ) on conflict (student_id) do update set
      school_id = excluded.school_id,
      external_school_name = excluded.external_school_name,
      external_city = excluded.external_city,
      external_state = excluded.external_state,
      no_previous_music_program = excluded.no_previous_music_program,
      source = excluded.source,
      updated_at = excluded.updated_at;

  elsif p_step_number = 5 then
    v_shirt_size := nullif(trim(coalesce(p_payload->>'shirtSize', '')), '');
    if v_shirt_size is not null and v_shirt_size not in ('XS','S','M','L','XL','2XL','3XL','4XL') then
      raise exception 'Invalid shirt size' using errcode = '22023';
    end if;
    insert into portal_student_measurements (
      student_id, shirt_size, shirt_size_source, shirt_size_updated_at,
      shirt_size_updated_by_person_id, source, measured_by, updated_at
    ) values (
      p_student_id, v_shirt_size, 'portal_onboarding', v_now,
      p_actor_person_id, 'portal_onboarding', 'family onboarding', v_now
    ) on conflict (student_id) do update set
      shirt_size = excluded.shirt_size,
      shirt_size_source = excluded.shirt_size_source,
      shirt_size_updated_at = excluded.shirt_size_updated_at,
      shirt_size_updated_by_person_id = excluded.shirt_size_updated_by_person_id,
      updated_at = excluded.updated_at;

    v_instrument_access := coalesce(p_payload->>'instrumentAccess', 'not_sure');
    if v_instrument_access not in ('personal', 'school', 'percussion', 'not_sure') then
      raise exception 'Invalid instrument access' using errcode = '22023';
    end if;
    insert into portal_student_music_profiles (
      student_id, instrument_access, source, updated_by_person_id, updated_at
    ) values (
      p_student_id, v_instrument_access, 'portal_onboarding', p_actor_person_id, v_now
    ) on conflict (student_id) do update set
      instrument_access = excluded.instrument_access,
      source = excluded.source,
      updated_by_person_id = excluded.updated_by_person_id,
      updated_at = excluded.updated_at;

    select coalesce(array_agg(value order by value), '{}') into v_areas
    from jsonb_array_elements_text(coalesce(p_payload->'supportAreas', '[]'::jsonb)) selected(value)
    where value in ('Instrument or equipment', 'Transportation', 'Class schedule', 'Accessibility', 'Cost', 'Something else');
    select jsonb_array_length(coalesce(p_payload->'supportAreas', '[]'::jsonb)) into v_expected_count;
    v_actual_count := cardinality(v_areas);
    if v_actual_count <> v_expected_count then
      raise exception 'Unknown support area' using errcode = '22023';
    end if;
    v_note := nullif(left(trim(coalesce(p_payload->>'studentNote', '')), 500), '');
    if cardinality(v_areas) = 0 and v_note is null then
      update portal_support_requests set status = 'closed_no_action', resolved_at = v_now,
        resolution_note = 'Cleared by family', updated_at = v_now
      where student_id = p_student_id and source = 'portal_onboarding' and status = 'open';
    else
      insert into portal_support_requests (
        student_id, submitted_by_person_id, areas, note, status, source, form_version, updated_at
      ) values (
        p_student_id, p_actor_person_id, v_areas, v_note, 'open', 'portal_onboarding', p_form_version, v_now
      ) on conflict (student_id, source) where status = 'open' and source = 'portal_onboarding'
      do update set
        submitted_by_person_id = excluded.submitted_by_person_id,
        areas = excluded.areas,
        note = excluded.note,
        form_version = excluded.form_version,
        updated_at = excluded.updated_at;
    end if;

  elsif p_step_number = 6 then
    if coalesce((p_payload->>'accurate')::boolean, false) is not true then
      raise exception 'Accuracy confirmation is required' using errcode = '22023';
    end if;
    if not exists (
      select 1 from portal_student_people relationship
      join portal_people guardian on guardian.id = relationship.person_id
      where relationship.student_id = p_student_id
        and relationship.primary_contact = true
        and relationship.emergency_contact = true
        and relationship.relationship_status not in ('rejected', 'superseded')
        and guardian.person_type <> 'student'
        and exists (
          select 1 from portal_contact_methods contact
          where contact.person_id = guardian.id and contact.contact_type = 'email'
            and contact.verification_status not in ('replaced', 'superseded', 'hard_bounce')
        )
        and exists (
          select 1 from portal_contact_methods contact
          where contact.person_id = guardian.id and contact.contact_type = 'phone'
            and contact.verification_status not in ('replaced', 'superseded')
        )
    ) then
      raise exception 'Primary guardian record is incomplete' using errcode = '22023';
    end if;
    if not exists (
      select 1 from portal_student_music_profiles music
      where music.student_id = p_student_id
        and (music.primary_instrument_none or music.primary_instrument_id is not null)
    ) or not exists (
      select 1 from portal_student_school_background background
      where background.student_id = p_student_id
    ) then
      raise exception 'Music background is incomplete' using errcode = '22023';
    end if;

    insert into portal_onboarding_completions (
      student_id, form_version, submitted_by_person_id, first_submitted_at,
      last_confirmed_at, confirmed_accurate, revision, source
    ) values (
      p_student_id, p_form_version, p_actor_person_id, v_now, v_now, true, 1, 'portal_onboarding'
    ) on conflict (student_id, form_version) do update set
      submitted_by_person_id = excluded.submitted_by_person_id,
      last_confirmed_at = excluded.last_confirmed_at,
      confirmed_accurate = true,
      revision = portal_onboarding_completions.revision + 1;
  end if;

  insert into portal_onboarding_progress (
    student_id, form_version, last_completed_step, completion_status,
    updated_by_person_id, updated_at
  ) values (
    p_student_id, p_form_version, p_step_number,
    case when p_step_number = 6 then 'complete' else 'in_progress' end,
    p_actor_person_id, v_now
  ) on conflict (student_id, form_version) do update set
    last_completed_step = greatest(portal_onboarding_progress.last_completed_step, excluded.last_completed_step),
    completion_status = case when excluded.completion_status = 'complete' then 'complete'
      else portal_onboarding_progress.completion_status end,
    updated_by_person_id = excluded.updated_by_person_id,
    updated_at = excluded.updated_at;

  insert into portal_onboarding_step_receipts (
    idempotency_key, student_id, form_version, step_number, submitted_by_person_id
  ) values (
    p_idempotency_key, p_student_id, p_form_version, p_step_number, p_actor_person_id
  );

  insert into audit_log (
    actor_type, actor_id, actor_name, action, table_name, record_id, changes, route
  ) values (
    case when v_actor_type = 'student' then 'student' else 'parent' end,
    p_actor_person_id::text, null,
    case when p_step_number = 6 then 'onboarding.submit' else 'onboarding.updated' end,
    'connected_student_onboarding', p_student_id::text,
    jsonb_build_object('step', p_step_number, 'form_version', p_form_version),
    '/api/portal/onboarding'
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'step', p_step_number,
    'complete', p_step_number = 6
  );
end;
$$;

revoke all on function portal_save_onboarding_step(uuid, uuid, text, int, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function portal_save_onboarding_step(uuid, uuid, text, int, jsonb, uuid)
  to service_role;

comment on function portal_save_onboarding_step(uuid, uuid, text, int, jsonb, uuid) is
  'Server-only transactional onboarding step save. Payload is transport only and is never stored as a raw answer blob.';
