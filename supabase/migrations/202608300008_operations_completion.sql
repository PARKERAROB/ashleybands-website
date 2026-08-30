-- Connected operations completion: lifecycle, scoped staff authority, dedicated
-- asset records, form evidence, atomic refund choices, and recovery metadata.
-- provenance: staff actions, family actions, BandsofAHS asset projections, and
-- service-run backup/restore processes are named explicitly on each record.

-- ---------------------------------------------------------------------------
-- Student lifecycle

alter table public.portal_student_status_events
  add column if not exists actor_staff_id uuid references public.staff(id) on delete set null;

update public.portal_student_status_events
set reason = 'Historical status record'
where nullif(btrim(reason), '') is null;

alter table public.portal_student_status_events
  alter column reason set not null;

create or replace function public.transition_student_status_with_audit(
  p_student_id uuid,
  p_to_status text,
  p_reason text,
  p_actor_staff_id uuid,
  p_route text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_status text;
  v_to_status text := lower(btrim(coalesce(p_to_status, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_actor_name text;
  v_memberships jsonb;
  v_additional_memberships_ended integer := 0;
begin
  if v_to_status not in ('active', 'inactive', 'inactive-graduated') then
    raise exception 'invalid student status';
  end if;
  if v_reason = '' then raise exception 'status reason required'; end if;

  select display_name into v_actor_name
  from staff
  where id = p_actor_staff_id
    and role in ('director', 'program_staff')
    and disabled_at is null;
  if v_actor_name is null then raise exception 'authorized active staff actor required'; end if;

  select status into v_from_status
  from portal_students
  where id = p_student_id
  for update;
  if not found then raise exception 'student not found' using errcode = 'P0002'; end if;

  if v_from_status = v_to_status then
    return jsonb_build_object(
      'changed', false,
      'studentId', p_student_id,
      'status', v_to_status,
      'membershipReconciliation', null
    );
  end if;

  update portal_students
  set status = v_to_status, updated_at = now()
  where id = p_student_id;

  insert into portal_student_status_events (
    student_id, from_status, to_status, reason, effective_at,
    changed_by, actor_staff_id, source
  ) values (
    p_student_id, v_from_status, v_to_status, v_reason, now(),
    v_actor_name, p_actor_staff_id, 'staff_status_transition'
  );

  v_memberships := reconcile_program_memberships_from_roster(array[p_student_id]);

  -- Roster reconciliation owns its projected rows. An inactive student must
  -- nevertheless have no current membership from any source; end remaining
  -- rows explicitly without guessing how they should be restored later.
  if v_to_status <> 'active' then
    with ended as (
      update program_memberships
      set ends_on = current_date, updated_at = now()
      where student_id = p_student_id and ends_on is null
      returning *
    ), recorded as (
      insert into program_membership_events (
        membership_id, group_id, student_id, event_type, effective_at,
        changed_by, source, detail
      )
      select id, group_id, student_id, 'ended', now(),
        v_actor_name, 'staff_status_transition',
        jsonb_build_object('reason', v_reason, 'student_status', v_to_status)
      from ended
      returning 1
    )
    select count(*) into v_additional_memberships_ended from recorded;
    v_memberships := coalesce(v_memberships, '{}'::jsonb)
      || jsonb_build_object('additionalEnded', v_additional_memberships_ended);
  end if;

  insert into audit_log (
    actor_type, actor_id, actor_name, action, table_name,
    record_id, changes, route
  ) values (
    'staff', p_actor_staff_id::text, v_actor_name, 'transition_status',
    'portal_students', p_student_id::text,
    jsonb_build_object(
      'status', jsonb_build_object('old', v_from_status, 'new', v_to_status),
      'reason', v_reason,
      'membership_reconciliation', v_memberships
    ),
    nullif(btrim(coalesce(p_route, '')), '')
  );

  return jsonb_build_object(
    'changed', true,
    'studentId', p_student_id,
    'status', v_to_status,
    'membershipReconciliation', v_memberships
  );
end;
$$;

-- The older RPC cannot establish an actor or reason. Keep its name as a hard
-- failure so stale server code cannot silently bypass lifecycle history.
create or replace function public.portal_set_student_status_and_reconcile(
  p_student_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'use transition_student_status_with_audit; actor and reason are required';
end;
$$;

revoke all on function public.portal_set_student_status_and_reconcile(uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function public.transition_student_status_with_audit(uuid,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.transition_student_status_with_audit(uuid,text,text,uuid,text)
  to service_role;

create or replace function public.update_student_profile_and_status_with_audit(
  p_student_id uuid,
  p_profile jsonb,
  p_to_status text,
  p_reason text,
  p_actor_staff_id uuid,
  p_route text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb := coalesce(p_profile, '{}'::jsonb);
  v_old portal_students%rowtype;
  v_new portal_students%rowtype;
  v_actor_name text;
  v_changes jsonb := '{}'::jsonb;
  v_status_result jsonb;
  v_unknown_keys text[];
begin
  if jsonb_typeof(v_profile) <> 'object' then
    raise exception 'student profile must be an object';
  end if;

  select array_agg(key order by key) into v_unknown_keys
  from jsonb_object_keys(v_profile) key
  where key not in (
    'legal_first', 'legal_last', 'preferred_first',
    'grade_fall26', 'school_email', 'cell_phone'
  );
  if v_unknown_keys is not null then
    raise exception 'unsupported student profile fields: %', array_to_string(v_unknown_keys, ', ');
  end if;

  select display_name into v_actor_name
  from staff
  where id = p_actor_staff_id
    and role in ('director', 'program_staff')
    and disabled_at is null;
  if v_actor_name is null then raise exception 'authorized active staff actor required'; end if;

  select * into v_old from portal_students
  where id = p_student_id for update;
  if not found then raise exception 'student not found' using errcode = 'P0002'; end if;

  update portal_students set
    legal_first = case when v_profile ? 'legal_first' then nullif(btrim(v_profile->>'legal_first'), '') else legal_first end,
    legal_last = case when v_profile ? 'legal_last' then nullif(btrim(v_profile->>'legal_last'), '') else legal_last end,
    preferred_first = case when v_profile ? 'preferred_first' then nullif(btrim(v_profile->>'preferred_first'), '') else preferred_first end,
    grade_fall26 = case when v_profile ? 'grade_fall26' then nullif(btrim(v_profile->>'grade_fall26'), '') else grade_fall26 end,
    school_email = case when v_profile ? 'school_email' then nullif(lower(btrim(v_profile->>'school_email')), '') else school_email end,
    cell_phone = case when v_profile ? 'cell_phone' then nullif(btrim(v_profile->>'cell_phone'), '') else cell_phone end,
    display_name = concat_ws(
      ' ',
      coalesce(
        case when v_profile ? 'preferred_first' then nullif(btrim(v_profile->>'preferred_first'), '') else preferred_first end,
        case when v_profile ? 'legal_first' then nullif(btrim(v_profile->>'legal_first'), '') else legal_first end
      ),
      case when v_profile ? 'legal_last' then nullif(btrim(v_profile->>'legal_last'), '') else legal_last end
    ),
    updated_at = now()
  where id = p_student_id
  returning * into v_new;

  if nullif(btrim(coalesce(v_new.legal_first, '')), '') is null
    or nullif(btrim(coalesce(v_new.legal_last, '')), '') is null
  then raise exception 'student legal first and last name are required'; end if;

  if v_old.legal_first is distinct from v_new.legal_first then
    v_changes := v_changes || jsonb_build_object('legal_first', jsonb_build_object('old', v_old.legal_first, 'new', v_new.legal_first));
  end if;
  if v_old.legal_last is distinct from v_new.legal_last then
    v_changes := v_changes || jsonb_build_object('legal_last', jsonb_build_object('old', v_old.legal_last, 'new', v_new.legal_last));
  end if;
  if v_old.preferred_first is distinct from v_new.preferred_first then
    v_changes := v_changes || jsonb_build_object('preferred_first', jsonb_build_object('old', v_old.preferred_first, 'new', v_new.preferred_first));
  end if;
  if v_old.grade_fall26 is distinct from v_new.grade_fall26 then
    v_changes := v_changes || jsonb_build_object('grade_fall26', jsonb_build_object('old', v_old.grade_fall26, 'new', v_new.grade_fall26));
  end if;
  if v_old.school_email is distinct from v_new.school_email then
    v_changes := v_changes || jsonb_build_object('school_email', jsonb_build_object('old', v_old.school_email, 'new', v_new.school_email));
  end if;
  if v_old.cell_phone is distinct from v_new.cell_phone then
    v_changes := v_changes || jsonb_build_object('cell_phone', jsonb_build_object('old', v_old.cell_phone, 'new', v_new.cell_phone));
  end if;
  if v_old.display_name is distinct from v_new.display_name then
    v_changes := v_changes || jsonb_build_object('display_name', jsonb_build_object('old', v_old.display_name, 'new', v_new.display_name));
  end if;

  if v_changes <> '{}'::jsonb then
    insert into audit_log (
      actor_type, actor_id, actor_name, action, table_name,
      record_id, changes, route
    ) values (
      'staff', p_actor_staff_id::text, v_actor_name,
      'update_student_profile', 'portal_students', p_student_id::text,
      v_changes, nullif(btrim(coalesce(p_route, '')), '')
    );
  end if;

  if nullif(btrim(coalesce(p_to_status, '')), '') is not null
    and lower(btrim(p_to_status)) is distinct from v_old.status
  then
    v_status_result := transition_student_status_with_audit(
      p_student_id, p_to_status, p_reason, p_actor_staff_id, p_route
    );
  else
    v_status_result := jsonb_build_object(
      'changed', false, 'studentId', p_student_id, 'status', v_old.status
    );
  end if;

  return jsonb_build_object(
    'studentId', p_student_id,
    'profileChanged', v_changes <> '{}'::jsonb,
    'status', v_status_result
  );
end;
$$;

revoke all on function public.update_student_profile_and_status_with_audit(uuid,jsonb,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.update_student_profile_and_status_with_audit(uuid,jsonb,text,text,uuid,text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Staff roles and explicit scopes. No staff account or scope is seeded here.

alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check
  check (role in (
    'director', 'sponsor_lead', 'program_staff',
    'booster_treasurer', 'event_worker'
  ));

alter table public.staff
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text not null default '',
  add column if not exists disabled_by_staff_id uuid references public.staff(id) on delete set null;

create table if not exists public.staff_scope_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  capability text not null,
  scope_type text not null
    check (scope_type in ('global','student','program_group','attendance_event','asset_type','form_definition')),
  scope_ref text not null default '',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  reason text not null,
  source text not null default 'staff_scope_assignment',
  created_by_staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (scope_type = 'global' and scope_ref = '')
    or (scope_type <> 'global' and nullif(btrim(scope_ref), '') is not null)
  ),
  check (ends_at is null or ends_at > starts_at),
  check (nullif(btrim(capability), '') is not null),
  check (nullif(btrim(reason), '') is not null)
);

create unique index if not exists staff_scope_assignments_one_open_idx
  on public.staff_scope_assignments (staff_id, capability, scope_type, scope_ref)
  where ends_at is null;
create index if not exists staff_scope_assignments_active_idx
  on public.staff_scope_assignments (staff_id, capability, starts_at, ends_at);

create or replace function public.manage_staff_access_with_audit(
  p_target_staff_id uuid,
  p_action text,
  p_role text,
  p_capability text,
  p_scope_type text,
  p_scope_ref text,
  p_reason text,
  p_actor_staff_id uuid,
  p_route text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_actor_name text;
  v_target_role text;
  v_new_role text;
  v_scope_id uuid;
begin
  if v_reason = '' then raise exception 'access change reason required'; end if;

  -- Serialize access changes so two directors cannot concurrently remove the
  -- last active director after both observe the same pre-change count.
  perform pg_advisory_xact_lock(hashtextextended('staff-access-management', 0));

  select display_name into v_actor_name
  from staff
  where id = p_actor_staff_id and role = 'director' and disabled_at is null
  for share;
  if v_actor_name is null then raise exception 'active director actor required'; end if;

  select role into v_target_role
  from staff where id = p_target_staff_id for update;
  if v_target_role is null then raise exception 'staff account not found' using errcode = 'P0002'; end if;

  if v_action = 'disable' then
    if p_target_staff_id = p_actor_staff_id then raise exception 'director cannot disable the active session'; end if;
    if v_target_role = 'director' and (
      select count(*) from staff where role = 'director' and disabled_at is null
    ) <= 1 then raise exception 'cannot disable the last active director'; end if;
    update staff set disabled_at = now(), disabled_reason = v_reason,
      disabled_by_staff_id = p_actor_staff_id,
      session_token = gen_random_uuid()
    where id = p_target_staff_id;
    v_new_role := v_target_role;
  elsif v_action = 'enable' then
    update staff set disabled_at = null, disabled_reason = '', disabled_by_staff_id = null,
      session_token = gen_random_uuid()
    where id = p_target_staff_id;
    v_new_role := v_target_role;
  elsif v_action = 'change_role' then
    if p_target_staff_id = p_actor_staff_id then raise exception 'director cannot change the active session role'; end if;
    if p_role not in (
      'director','sponsor_lead','program_staff','booster_treasurer','event_worker'
    ) then raise exception 'invalid staff role'; end if;
    if v_target_role = 'director' and p_role <> 'director' and (
      select count(*) from staff where role = 'director' and disabled_at is null
    ) <= 1 then raise exception 'cannot demote the last active director'; end if;
    update staff set role = p_role, session_token = gen_random_uuid()
    where id = p_target_staff_id;
    v_new_role := p_role;
  elsif v_action = 'grant_scope' then
    if nullif(btrim(coalesce(p_capability, '')), '') is null then raise exception 'capability required'; end if;
    if p_scope_type not in ('global','student','program_group','attendance_event','asset_type','form_definition') then
      raise exception 'invalid scope type';
    end if;
    if (p_scope_type = 'global' and btrim(coalesce(p_scope_ref, '')) <> '')
      or (p_scope_type <> 'global' and btrim(coalesce(p_scope_ref, '')) = '')
    then raise exception 'invalid scope reference'; end if;

    select id into v_scope_id
    from staff_scope_assignments
    where staff_id = p_target_staff_id
      and capability = btrim(p_capability)
      and scope_type = p_scope_type
      and scope_ref = btrim(coalesce(p_scope_ref, ''))
      and ends_at is null
    for update;
    if v_scope_id is null then
      insert into staff_scope_assignments (
        staff_id, capability, scope_type, scope_ref, reason,
        source, created_by_staff_id
      ) values (
        p_target_staff_id, btrim(p_capability), p_scope_type,
        btrim(coalesce(p_scope_ref, '')), v_reason,
        'staff_access_management', p_actor_staff_id
      ) returning id into v_scope_id;
    else
      update staff_scope_assignments set reason = v_reason,
        created_by_staff_id = p_actor_staff_id
      where id = v_scope_id;
    end if;
    v_new_role := v_target_role;
  elsif v_action = 'end_scope' then
    update staff_scope_assignments set ends_at = now(), reason = v_reason
    where staff_id = p_target_staff_id
      and capability = btrim(coalesce(p_capability, ''))
      and scope_type = p_scope_type
      and scope_ref = btrim(coalesce(p_scope_ref, ''))
      and ends_at is null
    returning id into v_scope_id;
    if v_scope_id is null then raise exception 'active scope assignment not found'; end if;
    v_new_role := v_target_role;
  else
    raise exception 'invalid access action';
  end if;

  insert into audit_log (
    actor_type, actor_id, actor_name, action, table_name,
    record_id, changes, route
  ) values (
    'staff', p_actor_staff_id::text, v_actor_name,
    'staff_access_' || v_action, 'staff', p_target_staff_id::text,
    jsonb_build_object(
      'role', jsonb_build_object('old', v_target_role, 'new', v_new_role),
      'capability', p_capability,
      'scope_type', p_scope_type,
      'scope_ref', p_scope_ref,
      'scope_assignment_id', v_scope_id,
      'reason', v_reason
    ),
    nullif(btrim(coalesce(p_route, '')), '')
  );

  return jsonb_build_object(
    'staffId', p_target_staff_id,
    'action', v_action,
    'role', v_new_role,
    'scopeAssignmentId', v_scope_id
  );
end;
$$;

revoke all on function public.manage_staff_access_with_audit(uuid,text,text,text,text,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.manage_staff_access_with_audit(uuid,text,text,text,text,text,text,uuid,text)
  to service_role;

create or replace function public.staff_add_guardian_with_audit(
  p_student_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_role text,
  p_primary boolean,
  p_actor_staff_id uuid,
  p_route text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_person_id uuid;
  v_person_type text;
  v_candidate_count integer := 0;
  v_matched_existing boolean := false;
  v_actor_name text;
begin
  select display_name into v_actor_name from staff
  where id=p_actor_staff_id and disabled_at is null and role in ('director','program_staff');
  if v_actor_name is null then raise exception 'authorized active staff actor required'; end if;
  if not exists (select 1 from portal_students where id=p_student_id) then raise exception 'student not found'; end if;
  if v_name='' or (v_email='' and v_phone='') then raise exception 'guardian name and contact required'; end if;
  if v_email<>'' and position('@' in v_email)=0 then raise exception 'valid guardian email required'; end if;
  if v_phone<>'' and length(v_phone)<7 then raise exception 'valid guardian phone required'; end if;

  -- Contact identity is global even though the physical table only has a
  -- per-person uniqueness constraint. Serialize exact matches so concurrent
  -- staff actions cannot create two guardian identities for one contact.
  if v_email<>'' then
    perform pg_advisory_xact_lock(hashtextextended('guardian-email:' || v_email, 0));
  end if;
  if v_phone<>'' then
    perform pg_advisory_xact_lock(hashtextextended('guardian-phone:' || v_phone, 0));
  end if;

  with candidates as (
    select distinct method.person_id
    from portal_contact_methods method
    where (v_email<>'' and method.contact_type='email' and method.value_normalized=v_email)
       or (v_phone<>'' and method.contact_type='phone' and method.value_normalized=v_phone)
  )
  select (array_agg(person_id order by person_id))[1], count(*)::integer
  into v_person_id, v_candidate_count
  from candidates;

  if v_candidate_count>1 then
    raise exception 'guardian contact matches multiple people; resolve identity before linking';
  end if;
  if v_person_id is not null then
    select person_type into v_person_type from portal_people
    where id=v_person_id for update;
    if v_person_type not in ('guardian','unknown') then
      raise exception 'contact belongs to a non-guardian identity';
    end if;
    v_matched_existing := true;
    if v_person_type='unknown' then
      update portal_people set person_type='guardian', updated_at=now()
      where id=v_person_id;
    end if;
  end if;

  if v_person_id is null then
    insert into portal_people (
      source_person_key,person_type,display_name,first_name,last_name,source
    ) values (
      'guardian:manual:' || gen_random_uuid()::text,'guardian',v_name,
      split_part(v_name,' ',1),nullif(btrim(substr(v_name,length(split_part(v_name,' ',1))+1)),''),'manual'
    ) returning id into v_person_id;
  end if;

  if v_email<>'' then
    insert into portal_contact_methods (
      person_id,contact_type,value_display,value_normalized,verification_status,source
    ) values (v_person_id,'email',btrim(p_email),v_email,'unverified','manual')
    on conflict (person_id,contact_type,value_normalized) do nothing;
  end if;
  if v_phone<>'' then
    insert into portal_contact_methods (
      person_id,contact_type,value_display,value_normalized,verification_status,source
    ) values (v_person_id,'phone',btrim(p_phone),v_phone,'unverified','manual')
    on conflict (person_id,contact_type,value_normalized) do nothing;
  end if;

  insert into portal_student_people (
    student_id,person_id,role,relationship_status,primary_contact,source,
    assurance_level,trust_source,assured_at,assured_by
  ) values (
    p_student_id,v_person_id,coalesce(nullif(btrim(p_role),''),'Parent'),
    'trusted',coalesce(p_primary,false),'manual',
    'high','staff_grant',now(),p_actor_staff_id::text
  ) on conflict (student_id,person_id) do update set
    role=excluded.role,relationship_status='trusted',primary_contact=excluded.primary_contact,
    source='manual',assurance_level='high',trust_source='staff_grant',
    assured_at=excluded.assured_at,assured_by=excluded.assured_by;

  insert into audit_log (
    actor_type,actor_id,actor_name,action,table_name,record_id,changes,route
  ) values (
    'staff',p_actor_staff_id::text,v_actor_name,'staff_guardian_link',
    'portal_people,portal_contact_methods,portal_student_people',
    p_student_id::text || ':' || v_person_id::text,
    jsonb_build_object(
      'student_id',p_student_id,'person_id',v_person_id,
      'role',coalesce(nullif(btrim(p_role),''),'Parent'),
      'assurance_level','high','trust_source','staff_grant',
      'matched_existing_identity',v_matched_existing
    ),
    nullif(btrim(coalesce(p_route,'')),'')
  );
  return jsonb_build_object('personId',v_person_id);
end;
$$;

revoke all on function public.staff_add_guardian_with_audit(uuid,text,text,text,text,boolean,uuid,text)
  from public, anon, authenticated;
grant execute on function public.staff_add_guardian_with_audit(uuid,text,text,text,text,boolean,uuid,text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Dedicated asset extensions

create table if not exists public.asset_lockers (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  locker_prefix text not null default '',
  locker_number text not null default '',
  bank_label text not null default '',
  notes text not null default ''
);

create table if not exists public.asset_tuners (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  tuner_number text not null default '',
  model text not null default '',
  physical_status text not null default '',
  notes text not null default ''
);

create table if not exists public.asset_music (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  title text not null default '',
  composer text not null default '',
  arranger text not null default '',
  publisher text not null default '',
  catalog_number text not null default '',
  grade_level text not null default '',
  copy_count integer check (copy_count is null or copy_count >= 0),
  notes text not null default ''
);

create table if not exists public.asset_uniforms (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  uniform_type text not null default '',
  piece_number text not null default '',
  size_label text not null default '',
  style_label text not null default '',
  notes text not null default ''
);

-- Locker and tuner sources are already connected. Keep their dedicated records
-- synchronized from the base import without inventing music or uniform rows.
create or replace function public.sync_connected_asset_extensions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.asset_type = 'locker' then
    insert into asset_lockers (asset_id, locker_prefix, locker_number)
    values (
      new.id,
      coalesce(new.metadata->>'locker_prefix', ''),
      coalesce(nullif(new.metadata->>'locker_number', ''), new.source_key, '')
    )
    on conflict (asset_id) do update set
      locker_prefix = excluded.locker_prefix,
      locker_number = excluded.locker_number;
  elsif new.asset_type = 'tuner' then
    insert into asset_tuners (asset_id, tuner_number, physical_status, notes)
    values (
      new.id,
      coalesce(nullif(new.metadata->>'tuner_number', ''), new.source_key, ''),
      coalesce(new.metadata->>'physical_status', ''),
      coalesce(new.metadata->>'notes', '')
    )
    on conflict (asset_id) do update set
      tuner_number = excluded.tuner_number,
      physical_status = excluded.physical_status,
      notes = excluded.notes;
  end if;
  return new;
end;
$$;

drop trigger if exists assets_sync_connected_extensions on public.assets;
create trigger assets_sync_connected_extensions
  after insert or update of asset_type, source_key, metadata on public.assets
  for each row execute function public.sync_connected_asset_extensions();

insert into public.asset_lockers (asset_id, locker_prefix, locker_number)
select id, coalesce(metadata->>'locker_prefix', ''),
  coalesce(nullif(metadata->>'locker_number', ''), source_key, '')
from public.assets
where asset_type = 'locker'
on conflict (asset_id) do update set
  locker_prefix = excluded.locker_prefix,
  locker_number = excluded.locker_number;

insert into public.asset_tuners (asset_id, tuner_number, physical_status, notes)
select id,
  coalesce(nullif(metadata->>'tuner_number', ''), source_key, ''),
  coalesce(metadata->>'physical_status', ''),
  coalesce(metadata->>'notes', '')
from public.assets
where asset_type = 'tuner'
on conflict (asset_id) do update set
  tuner_number = excluded.tuner_number,
  physical_status = excluded.physical_status,
  notes = excluded.notes;

create index if not exists asset_events_asset_occurred_idx
  on public.asset_events (asset_id, occurred_at desc);
create index if not exists asset_assignments_asset_history_idx
  on public.asset_assignments (asset_id, created_at desc);

create or replace function public.record_asset_operation_with_audit(
  p_asset_id uuid,
  p_operation text,
  p_student_id uuid,
  p_condition_summary text,
  p_operational_status text,
  p_note text,
  p_actor_staff_id uuid,
  p_route text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation text := lower(btrim(coalesce(p_operation, '')));
  v_note text := btrim(coalesce(p_note, ''));
  v_actor_name text;
  v_asset_type text;
  v_lifecycle text;
  v_assignment_id uuid;
  v_from_student_id uuid;
  v_new_assignment_id uuid;
  v_now timestamptz := now();
  v_details jsonb;
begin
  if v_operation not in ('assign','transfer','return','condition','missing') then
    raise exception 'invalid asset operation';
  end if;
  if v_note = '' then raise exception 'asset operation note required'; end if;
  select display_name into v_actor_name from staff where id = p_actor_staff_id;
  if v_actor_name is null then raise exception 'staff actor required'; end if;

  select asset_type, lifecycle_status into v_asset_type, v_lifecycle
  from assets where id = p_asset_id for update;
  if not found then raise exception 'asset not found' using errcode = 'P0002'; end if;

  select id, student_id into v_assignment_id, v_from_student_id
  from asset_assignments
  where asset_id = p_asset_id and ends_at is null
    and assignment_status in ('current','provisional')
  for update;

  if v_operation in ('assign','transfer') then
    if not exists (
      select 1 from portal_students where id = p_student_id and status = 'active'
    ) then raise exception 'active student required'; end if;
  end if;

  if v_operation = 'assign' then
    if v_lifecycle <> 'active' then raise exception 'active asset required'; end if;
    if v_assignment_id is not null then raise exception 'asset already assigned'; end if;
    insert into asset_assignments (
      asset_id, student_id, starts_at, assignment_status,
      source_system, source_ref, notes
    ) values (
      p_asset_id, p_student_id, v_now, 'current',
      'staff_asset_operation', coalesce(p_route, ''), v_note
    ) returning id into v_new_assignment_id;
    v_details := jsonb_build_object(
      'assignment_id', v_new_assignment_id, 'student_id', p_student_id
    );
  elsif v_operation = 'transfer' then
    if v_lifecycle <> 'active' then raise exception 'active asset required'; end if;
    if v_assignment_id is null then raise exception 'open assignment required'; end if;
    if v_from_student_id = p_student_id then raise exception 'asset is already assigned to this student'; end if;
    update asset_assignments set
      ends_at = v_now, assignment_status = 'returned', updated_at = v_now,
      notes = concat_ws(E'\n', nullif(notes, ''), 'Transferred: ' || v_note)
    where id = v_assignment_id;
    insert into asset_assignments (
      asset_id, student_id, starts_at, assignment_status,
      source_system, source_ref, notes
    ) values (
      p_asset_id, p_student_id, v_now, 'current',
      'staff_asset_operation', coalesce(p_route, ''), v_note
    ) returning id into v_new_assignment_id;
    v_details := jsonb_build_object(
      'from_assignment_id', v_assignment_id,
      'from_student_id', v_from_student_id,
      'assignment_id', v_new_assignment_id,
      'student_id', p_student_id
    );
  elsif v_operation = 'return' then
    if v_assignment_id is null then raise exception 'open assignment required'; end if;
    update asset_assignments set
      ends_at = v_now, assignment_status = 'returned', updated_at = v_now,
      notes = concat_ws(E'\n', nullif(notes, ''), 'Returned: ' || v_note)
    where id = v_assignment_id;
    v_details := jsonb_build_object(
      'assignment_id', v_assignment_id, 'student_id', v_from_student_id
    );
  elsif v_operation = 'condition' then
    if nullif(btrim(coalesce(p_condition_summary, '')), '') is null
      and nullif(btrim(coalesce(p_operational_status, '')), '') is null
    then raise exception 'condition or operational status required'; end if;
    update assets set
      condition_summary = case
        when nullif(btrim(coalesce(p_condition_summary, '')), '') is null then condition_summary
        else left(btrim(p_condition_summary), 500)
      end,
      operational_status = case
        when nullif(btrim(coalesce(p_operational_status, '')), '') is null then operational_status
        else left(btrim(p_operational_status), 100)
      end
    where id = p_asset_id;
    v_details := jsonb_build_object(
      'condition_summary', nullif(btrim(coalesce(p_condition_summary, '')), ''),
      'operational_status', nullif(btrim(coalesce(p_operational_status, '')), '')
    );
  elsif v_operation = 'missing' then
    update assets set lifecycle_status = 'missing', operational_status = 'missing'
    where id = p_asset_id;
    v_details := jsonb_build_object(
      'assignment_id', v_assignment_id, 'student_id', v_from_student_id
    );
  end if;

  insert into asset_events (
    asset_id, event_type, occurred_at, actor_staff_id,
    source_system, source_ref, summary, details
  ) values (
    p_asset_id, v_operation, v_now, p_actor_staff_id,
    'staff_asset_operation', coalesce(p_route, ''), v_note,
    coalesce(v_details, '{}'::jsonb)
  );

  insert into audit_log (
    actor_type, actor_id, actor_name, action, table_name,
    record_id, changes, route
  ) values (
    'staff', p_actor_staff_id::text, v_actor_name,
    'asset_' || v_operation, 'assets', p_asset_id::text,
    jsonb_build_object(
      'asset_type', v_asset_type,
      'student_id', p_student_id,
      'note', v_note,
      'details', coalesce(v_details, '{}'::jsonb)
    ),
    nullif(btrim(coalesce(p_route, '')), '')
  );

  return jsonb_build_object(
    'assetId', p_asset_id,
    'operation', v_operation,
    'assignmentId', v_new_assignment_id,
    'details', coalesce(v_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.record_asset_operation_with_audit(uuid,text,uuid,text,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.record_asset_operation_with_audit(uuid,text,uuid,text,text,text,uuid,text)
  to service_role;

-- ---------------------------------------------------------------------------
-- External, paper, and staff-record form evidence

create unique index if not exists form_submission_references_identity_idx
  on public.form_submission_references (
    student_requirement_id, reference_type, source_table, source_record_id
  );

create or replace function public.record_form_submission_with_reference(
  p_requirement_id uuid,
  p_student_id uuid,
  p_state text,
  p_completion_mode text,
  p_next_action text,
  p_note_summary text,
  p_reference_type text,
  p_source_table text,
  p_source_record_id text,
  p_received_at timestamptz,
  p_reference_metadata jsonb,
  p_actor_staff_id uuid,
  p_route text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_requirement_id uuid;
  v_reference_id uuid;
  v_delivery_type text;
  v_reference_type text := nullif(btrim(coalesce(p_reference_type, '')), '');
  v_source_record_id text := btrim(coalesce(p_source_record_id, ''));
  v_actor_name text;
begin
  select display_name into v_actor_name from staff where id = p_actor_staff_id;
  if v_actor_name is null then raise exception 'staff actor required'; end if;

  select version.delivery_type into v_delivery_type
  from form_requirements requirement
  join form_versions version on version.id = requirement.version_id
  where requirement.id = p_requirement_id;
  if v_delivery_type is null then raise exception 'form requirement not found'; end if;
  if v_delivery_type = 'portal' then raise exception 'portal workflow owns this status'; end if;
  if v_delivery_type <> p_completion_mode then raise exception 'completion mode does not match form version'; end if;

  if v_reference_type is not null then
    if v_source_record_id = '' then raise exception 'reference record id required'; end if;
    if (p_completion_mode = 'external' and v_reference_type <> 'external_reference')
      or (p_completion_mode = 'paper' and v_reference_type <> 'paper_receipt')
      or (p_completion_mode = 'staff_record' and v_reference_type <> 'staff_record')
    then raise exception 'reference type does not match completion mode'; end if;
  end if;

  v_student_requirement_id := set_student_form_requirement_state(
    p_requirement_id, p_student_id, p_state, p_completion_mode,
    p_next_action, p_note_summary, p_actor_staff_id
  );

  if v_reference_type is not null then
    insert into form_submission_references (
      student_requirement_id, reference_type, source_table, source_record_id,
      received_at, received_by_staff_id, metadata
    ) values (
      v_student_requirement_id, v_reference_type,
      btrim(coalesce(p_source_table, '')), v_source_record_id,
      coalesce(p_received_at, now()), p_actor_staff_id,
      coalesce(p_reference_metadata, '{}'::jsonb)
    )
    on conflict (
      student_requirement_id, reference_type, source_table, source_record_id
    ) do update set
      received_at = excluded.received_at,
      received_by_staff_id = excluded.received_by_staff_id,
      metadata = excluded.metadata
    returning id into v_reference_id;

    update student_form_requirements
    set source_ref = concat_ws(':', v_reference_type, v_source_record_id),
      updated_at = now()
    where id = v_student_requirement_id;
  end if;

  insert into audit_log (
    actor_type, actor_id, actor_name, action, table_name,
    record_id, changes, route
  ) values (
    'staff', p_actor_staff_id::text, v_actor_name,
    'record_form_state', 'student_form_requirements',
    v_student_requirement_id::text,
    jsonb_build_object(
      'student_id', p_student_id,
      'requirement_id', p_requirement_id,
      'state', p_state,
      'completion_mode', p_completion_mode,
      'reference_id', v_reference_id,
      'reference_type', v_reference_type
    ),
    nullif(btrim(coalesce(p_route, '')), '')
  );

  return jsonb_build_object(
    'studentRequirementId', v_student_requirement_id,
    'referenceId', v_reference_id,
    'state', p_state
  );
end;
$$;

revoke all on function public.record_form_submission_with_reference(uuid,uuid,text,text,text,text,text,text,text,timestamptz,jsonb,uuid,text)
  from public, anon, authenticated;
grant execute on function public.record_form_submission_with_reference(uuid,uuid,text,text,text,text,text,text,text,timestamptz,jsonb,uuid,text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Atomic family spring-trip refund choice

create or replace function public.apply_spring_trip_refund_choice(
  p_student_id uuid,
  p_choice text,
  p_actor_person_id uuid,
  p_route text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit spring_trip_refund_credits%rowtype;
  v_invoice_id text := 'sptrip-forgo-' || p_student_id::text;
  v_payment_id uuid;
  v_actor_name text;
  v_choice text := lower(btrim(coalesce(p_choice, '')));
begin
  if v_choice not in ('forgo', 'check') then raise exception 'invalid choice'; end if;

  select person.display_name into v_actor_name
  from portal_student_people link
  join portal_people person on person.id = link.person_id
  join portal_students student on student.id = link.student_id
  where link.person_id = p_actor_person_id
    and link.student_id = p_student_id
    and link.relationship_status = 'trusted'
    and link.assurance_level in ('medium','high')
    and person.person_type = 'guardian'
    and student.status = 'active';
  if v_actor_name is null then raise exception 'trusted active guardian required'; end if;

  select * into v_credit
  from spring_trip_refund_credits
  where student_id = p_student_id
  for update;
  if not found then raise exception 'refund offer not found' using errcode = 'P0002'; end if;

  if v_credit.status <> 'offered' then
    return jsonb_build_object(
      'changed', false,
      'status', v_credit.status,
      'confirmed_cents', v_credit.confirmed_cents,
      'topup_cents', v_credit.topup_cents,
      'full_cents', v_credit.full_cents,
      'applied_at', v_credit.applied_at
    );
  end if;

  if v_choice = 'forgo' then
    insert into fee_payments (
      student_id, amount_cents, method, status, category, kind,
      invoice_id, is_sponsorship, payer_name, recorded_by,
      received_at, notes
    ) values (
      p_student_id, v_credit.confirmed_cents, 'credit', 'completed',
      'marching_band_2026', 'funding_goal', v_invoice_id, false,
      'Spring Trip refund (forgone)', 'family_online', now(),
      'Family forwent their cancelled Spring Trip 2026 refund; credited to the marching band funding goal.'
    )
    on conflict (invoice_id) do nothing
    returning id into v_payment_id;

    if v_payment_id is null then
      select id into v_payment_id
      from fee_payments
      where invoice_id = v_invoice_id
        and student_id = p_student_id
        and amount_cents = v_credit.confirmed_cents
        and status = 'completed'
        and kind = 'funding_goal'
        and coalesce(is_sponsorship, false) = false;
      if v_payment_id is null then raise exception 'refund payment identity conflict'; end if;
    end if;

    update spring_trip_refund_credits
    set status = 'applied_mb', applied_at = now()
    where id = v_credit.id
    returning * into v_credit;
  else
    update spring_trip_refund_credits
    set status = 'check', applied_at = now()
    where id = v_credit.id
    returning * into v_credit;
  end if;

  insert into audit_log (
    actor_type, actor_id, actor_name, action, table_name,
    record_id, changes, route
  ) values (
    'parent', p_actor_person_id::text, v_actor_name,
    'spring_trip_refund_choice', 'spring_trip_refund_credits',
    v_credit.id::text,
    jsonb_build_object(
      'student_id', p_student_id,
      'choice', v_choice,
      'status', v_credit.status,
      'payment_id', v_payment_id,
      'amount_cents', case when v_choice = 'forgo' then v_credit.confirmed_cents else 0 end
    ),
    nullif(btrim(coalesce(p_route, '')), '')
  );

  return jsonb_build_object(
    'changed', true,
    'status', v_credit.status,
    'confirmed_cents', v_credit.confirmed_cents,
    'topup_cents', v_credit.topup_cents,
    'full_cents', v_credit.full_cents,
    'applied_at', v_credit.applied_at
  );
end;
$$;

revoke all on function public.apply_spring_trip_refund_choice(uuid,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.apply_spring_trip_refund_choice(uuid,text,uuid,text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Protected backup and restore verification metadata. These tables contain
-- evidence only; they do not store backup payloads or credentials.

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_kind text not null
    check (backup_kind in ('manual','scheduled','pre_release','post_release')),
  status text not null
    check (status in ('running','complete','partial','failed')),
  source text not null,
  source_ref text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  backup_through_at timestamptz,
  object_count integer not null default 0 check (object_count >= 0),
  row_count bigint not null default 0 check (row_count >= 0),
  byte_count bigint not null default 0 check (byte_count >= 0),
  manifest_sha256 text not null default ''
    check (manifest_sha256 = '' or manifest_sha256 ~ '^[0-9a-f]{64}$'),
  storage_label text not null default '',
  error_summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by_staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at)
);

create index if not exists backup_runs_status_started_idx
  on public.backup_runs (status, started_at desc);
create unique index if not exists backup_runs_source_ref_unique_idx
  on public.backup_runs (source_ref) where source_ref <> '';

create table if not exists public.restore_verifications (
  id uuid primary key default gen_random_uuid(),
  backup_run_id uuid not null references public.backup_runs(id) on delete restrict,
  status text not null
    check (status in ('running','passed','partial','failed')),
  target_label text not null,
  source text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  expected_object_count integer not null default 0 check (expected_object_count >= 0),
  verified_object_count integer not null default 0 check (verified_object_count >= 0),
  expected_row_count bigint not null default 0 check (expected_row_count >= 0),
  verified_row_count bigint not null default 0 check (verified_row_count >= 0),
  manifest_sha256 text not null default ''
    check (manifest_sha256 = '' or manifest_sha256 ~ '^[0-9a-f]{64}$'),
  verification_sha256 text not null default ''
    check (verification_sha256 = '' or verification_sha256 ~ '^[0-9a-f]{64}$'),
  summary jsonb not null default '{}'::jsonb,
  error_summary text not null default '',
  verified_by_staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at)
);

create index if not exists restore_verifications_backup_started_idx
  on public.restore_verifications (backup_run_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Protection

alter table public.staff_scope_assignments enable row level security;
alter table public.asset_lockers enable row level security;
alter table public.asset_tuners enable row level security;
alter table public.asset_music enable row level security;
alter table public.asset_uniforms enable row level security;
alter table public.backup_runs enable row level security;
alter table public.restore_verifications enable row level security;

revoke all privileges on table public.staff_scope_assignments from anon, authenticated;
revoke all privileges on table public.asset_lockers from anon, authenticated;
revoke all privileges on table public.asset_tuners from anon, authenticated;
revoke all privileges on table public.asset_music from anon, authenticated;
revoke all privileges on table public.asset_uniforms from anon, authenticated;
revoke all privileges on table public.backup_runs from anon, authenticated;
revoke all privileges on table public.restore_verifications from anon, authenticated;

comment on table public.staff_scope_assignments is
  'Explicit capability scopes for limited staff roles. This migration intentionally seeds no assignments.';
comment on table public.asset_music is
  'Dedicated music extension. It remains empty until a reviewed music source is connected.';
comment on table public.asset_uniforms is
  'Dedicated physical-uniform extension. Measurements are not inventory and do not populate this table.';
comment on table public.backup_runs is
  'Protected metadata describing a backup run; backup contents remain in the private recovery home.';
comment on table public.restore_verifications is
  'Protected evidence from a bounded restore verification; never proof until status is passed.';

notify pgrst, 'reload schema';
