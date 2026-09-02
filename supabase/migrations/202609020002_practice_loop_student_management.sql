-- Recoverable staff management for account-free Practice Loop participants.
-- provenance: staff-attributed correction or removal of student-provided prototype identity data.

alter table public.practice_loop_prototype_submissions
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by_staff_id uuid references public.staff(id);

create index if not exists practice_loop_prototype_active_piece_name_idx
  on public.practice_loop_prototype_submissions (piece_key, display_name)
  where removed_at is null;

create or replace function public.manage_practice_loop_submission_with_audit(
  p_submission_id uuid,
  p_piece_key text,
  p_action text,
  p_display_name text,
  p_actor_staff_id uuid,
  p_route text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_display_name text := regexp_replace(btrim(coalesce(p_display_name, '')), '\s+', ' ', 'g');
  v_actor_name text;
  v_old_name text;
  v_instrument text;
  v_removed_at timestamptz;
begin
  select display_name into v_actor_name
  from public.staff
  where id = p_actor_staff_id and role = 'director' and disabled_at is null;
  if v_actor_name is null then raise exception 'active director actor required'; end if;

  select display_name, instrument into v_old_name, v_instrument
  from public.practice_loop_prototype_submissions
  where id = p_submission_id
    and piece_key = p_piece_key
    and removed_at is null
  for update;
  if v_old_name is null then raise exception 'active practice participant not found' using errcode = 'P0002'; end if;

  if v_action = 'rename' then
    if char_length(v_display_name) < 2 or char_length(v_display_name) > 80 then
      raise exception 'valid student name required';
    end if;
    update public.practice_loop_prototype_submissions
      set display_name = v_display_name, updated_at = now()
      where id = p_submission_id;
  elsif v_action = 'remove' then
    v_removed_at := now();
    update public.practice_loop_prototype_submissions
      set removed_at = v_removed_at,
          removed_by_staff_id = p_actor_staff_id,
          updated_at = v_removed_at
      where id = p_submission_id;
  else
    raise exception 'invalid practice participant action';
  end if;

  insert into public.audit_log (
    actor_type, actor_id, actor_name, action, table_name,
    record_id, changes, route
  ) values (
    'staff', p_actor_staff_id::text, v_actor_name,
    'practice_loop.prototype.' || v_action,
    'practice_loop_prototype_submissions', p_submission_id::text,
    case when v_action = 'rename' then jsonb_build_object(
      'display_name', jsonb_build_object('old', v_old_name, 'new', v_display_name)
    ) else jsonb_build_object(
      'removed_at', v_removed_at,
      'instrument', v_instrument
    ) end,
    nullif(btrim(coalesce(p_route, '')), '')
  );

  return jsonb_build_object('submissionId', p_submission_id, 'action', v_action);
end;
$$;

revoke all on function public.manage_practice_loop_submission_with_audit(uuid,text,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.manage_practice_loop_submission_with_audit(uuid,text,text,text,uuid,text)
  to service_role;

comment on column public.practice_loop_prototype_submissions.removed_at is
  'When set, excludes this recoverable staff-removed prototype participant from active views.';
