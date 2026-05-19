-- Fix: staff_sprint_join's OUT column session_id collides with
-- staff_sprint_races.session_id inside the function body, raising
-- "column reference 'session_id' is ambiguous" on join attempts.
-- Drop + recreate with prefixed OUT names.

drop function if exists staff_sprint_join(text, text, text, text);

create or replace function staff_sprint_join(
  p_code text,
  p_display_name text,
  p_instrument text,
  p_period text
) returns table (out_player_id uuid, out_race_id uuid, out_session_id uuid)
language plpgsql
security definer
as $$
declare
  v_session staff_sprint_sessions;
  v_race staff_sprint_races;
  v_player_id uuid;
  v_count int;
  v_next_race_num int;
begin
  select * into v_session from staff_sprint_sessions
   where code = upper(p_code) and status = 'open' for update;
  if not found then
    raise exception 'session not found or closed';
  end if;

  select r.* into v_race
    from staff_sprint_races r
   where r.session_id = v_session.id and r.status = 'waiting'
     and (select count(*) from staff_sprint_players p where p.race_id = r.id) < v_session.race_size
   order by r.race_number asc
   limit 1
   for update;

  if not found then
    select coalesce(max(r.race_number), 0) + 1 into v_next_race_num
      from staff_sprint_races r where r.session_id = v_session.id;
    insert into staff_sprint_races (session_id, race_number)
    values (v_session.id, v_next_race_num)
    returning * into v_race;
  end if;

  insert into staff_sprint_players (session_id, race_id, display_name, instrument, period, status)
  values (v_session.id, v_race.id, p_display_name, p_instrument, p_period, 'waiting')
  returning id into v_player_id;

  select count(*) into v_count from staff_sprint_players p where p.race_id = v_race.id;
  if v_count >= v_session.race_size then
    update staff_sprint_races set status = 'active', started_at = now() where id = v_race.id;
    update staff_sprint_players set status = 'racing' where race_id = v_race.id;
  end if;

  return query select v_player_id, v_race.id, v_session.id;
end;
$$;

grant execute on function staff_sprint_join(text, text, text, text) to anon, authenticated;

-- Same defensive fix on replay — qualify race_number reference.
drop function if exists staff_sprint_replay(uuid);

create or replace function staff_sprint_replay(
  p_player_id uuid
) returns table (out_new_race_id uuid)
language plpgsql
security definer
as $$
declare
  v_player staff_sprint_players;
  v_session staff_sprint_sessions;
  v_race staff_sprint_races;
  v_count int;
  v_next_race_num int;
begin
  select * into v_player from staff_sprint_players where id = p_player_id for update;
  if not found then raise exception 'player not found'; end if;
  select * into v_session from staff_sprint_sessions where id = v_player.session_id for update;

  select r.* into v_race
    from staff_sprint_races r
   where r.session_id = v_session.id and r.status = 'waiting'
     and r.id <> coalesce(v_player.race_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and (select count(*) from staff_sprint_players p where p.race_id = r.id) < v_session.race_size
   order by r.race_number asc
   limit 1
   for update;

  if not found then
    select coalesce(max(r.race_number), 0) + 1 into v_next_race_num
      from staff_sprint_races r where r.session_id = v_session.id;
    insert into staff_sprint_races (session_id, race_number)
    values (v_session.id, v_next_race_num)
    returning * into v_race;
  end if;

  update staff_sprint_players
     set race_id = v_race.id, score = 0, incorrect = 0, status = 'waiting'
   where id = p_player_id;

  select count(*) into v_count from staff_sprint_players p where p.race_id = v_race.id;
  if v_count >= v_session.race_size then
    update staff_sprint_races set status = 'active', started_at = now() where id = v_race.id;
    update staff_sprint_players set status = 'racing' where race_id = v_race.id;
  end if;

  return query select v_race.id;
end;
$$;

grant execute on function staff_sprint_replay(uuid) to anon, authenticated;
