-- Staff Sprint: Note Race
-- Real-time classroom game. Students join a session, get auto-grouped into
-- 4-6 player races, identify staff notes, first to N correct wins.
-- Server-side RPCs handle grouping + answer submission to avoid race conditions
-- on the client. Realtime is broadcast via Supabase Realtime channels.

create extension if not exists "pgcrypto";

-- ============ Tables ============

create table if not exists staff_sprint_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('treble_beginner','bass_beginner','mixed_beginner')),
  race_size int not null default 6 check (race_size between 2 and 8),
  win_score int not null default 20 check (win_score between 5 and 50),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists staff_sprint_races (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references staff_sprint_sessions(id) on delete cascade,
  race_number int not null,
  status text not null default 'waiting' check (status in ('waiting','active','finished')),
  started_at timestamptz,
  finished_at timestamptz,
  winner_player_id uuid,
  created_at timestamptz not null default now(),
  unique (session_id, race_number)
);

create table if not exists staff_sprint_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references staff_sprint_sessions(id) on delete cascade,
  race_id uuid references staff_sprint_races(id) on delete set null,
  display_name text not null,
  instrument text,
  period text,
  score int not null default 0,
  incorrect int not null default 0,
  status text not null default 'waiting' check (status in ('waiting','racing','finished')),
  joined_at timestamptz not null default now()
);

create index if not exists staff_sprint_races_session_idx on staff_sprint_races(session_id, status);
create index if not exists staff_sprint_players_race_idx on staff_sprint_players(race_id);
create index if not exists staff_sprint_players_session_idx on staff_sprint_players(session_id);

-- ============ Realtime ============

alter publication supabase_realtime add table staff_sprint_races;
alter publication supabase_realtime add table staff_sprint_players;

-- ============ RPCs ============

-- Create a session with a short human code.
create or replace function staff_sprint_create_session(
  p_mode text,
  p_race_size int,
  p_win_score int
) returns staff_sprint_sessions
language plpgsql
security definer
as $$
declare
  v_code text;
  v_session staff_sprint_sessions;
  v_attempts int := 0;
begin
  loop
    v_code := upper(substring(md5(random()::text) from 1 for 5));
    begin
      insert into staff_sprint_sessions (code, mode, race_size, win_score)
      values (v_code, p_mode, p_race_size, p_win_score)
      returning * into v_session;
      return v_session;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then raise; end if;
    end;
  end loop;
end;
$$;

-- Join a session: find or create an open race, assign player.
create or replace function staff_sprint_join(
  p_code text,
  p_display_name text,
  p_instrument text,
  p_period text
) returns table (player_id uuid, race_id uuid, session_id uuid)
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

  -- Find an open race that isn't full
  select r.* into v_race
    from staff_sprint_races r
   where r.session_id = v_session.id and r.status = 'waiting'
     and (select count(*) from staff_sprint_players p where p.race_id = r.id) < v_session.race_size
   order by r.race_number asc
   limit 1
   for update;

  if not found then
    select coalesce(max(race_number), 0) + 1 into v_next_race_num
      from staff_sprint_races where session_id = v_session.id;
    insert into staff_sprint_races (session_id, race_number)
    values (v_session.id, v_next_race_num)
    returning * into v_race;
  end if;

  insert into staff_sprint_players (session_id, race_id, display_name, instrument, period, status)
  values (v_session.id, v_race.id, p_display_name, p_instrument, p_period, 'waiting')
  returning id into v_player_id;

  -- Auto-start when full
  select count(*) into v_count from staff_sprint_players where race_id = v_race.id;
  if v_count >= v_session.race_size then
    update staff_sprint_races set status = 'active', started_at = now() where id = v_race.id;
    update staff_sprint_players set status = 'racing' where race_id = v_race.id;
  end if;

  return query select v_player_id, v_race.id, v_session.id;
end;
$$;

-- Backstop: start any waiting race in a session with >= min_players that has waited > grace seconds.
create or replace function staff_sprint_start_stalled(
  p_session_id uuid,
  p_min_players int default 2,
  p_grace_seconds int default 20
) returns int
language plpgsql
security definer
as $$
declare
  v_started int := 0;
  v_race record;
begin
  for v_race in
    select r.id
      from staff_sprint_races r
     where r.session_id = p_session_id and r.status = 'waiting'
       and r.created_at < now() - make_interval(secs => p_grace_seconds)
       and (select count(*) from staff_sprint_players p where p.race_id = r.id) >= p_min_players
  loop
    update staff_sprint_races set status = 'active', started_at = now() where id = v_race.id;
    update staff_sprint_players set status = 'racing' where race_id = v_race.id;
    v_started := v_started + 1;
  end loop;
  return v_started;
end;
$$;

-- Submit an answer. is_correct must be validated server-side by checking the note pool,
-- but since note generation is client-driven (random pick), we trust the client's
-- correctness check here. Anti-cheat is out of scope for v1 (classroom use, teacher present).
create or replace function staff_sprint_submit_answer(
  p_player_id uuid,
  p_is_correct boolean
) returns table (
  new_score int,
  race_status text,
  winner_player_id uuid
)
language plpgsql
security definer
as $$
declare
  v_player staff_sprint_players;
  v_race staff_sprint_races;
  v_session staff_sprint_sessions;
  v_winner_id uuid;
begin
  select * into v_player from staff_sprint_players where id = p_player_id for update;
  if not found then raise exception 'player not found'; end if;
  if v_player.status <> 'racing' then
    return query select v_player.score, 'not_racing'::text, null::uuid;
    return;
  end if;

  select * into v_race from staff_sprint_races where id = v_player.race_id for update;
  if v_race.status <> 'active' then
    return query select v_player.score, v_race.status, v_race.winner_player_id;
    return;
  end if;

  select * into v_session from staff_sprint_sessions where id = v_player.session_id;

  if p_is_correct then
    update staff_sprint_players set score = score + 1 where id = p_player_id
      returning score into v_player.score;
  else
    update staff_sprint_players set incorrect = incorrect + 1 where id = p_player_id;
  end if;

  -- Win check
  if p_is_correct and v_player.score >= v_session.win_score then
    update staff_sprint_races
       set status = 'finished', finished_at = now(), winner_player_id = p_player_id
     where id = v_race.id;
    update staff_sprint_players set status = 'finished' where race_id = v_race.id;
    v_winner_id := p_player_id;
    return query select v_player.score, 'finished'::text, v_winner_id;
    return;
  end if;

  return query select v_player.score, v_race.status, v_race.winner_player_id;
end;
$$;

-- Reset a finished player to rejoin the pool.
create or replace function staff_sprint_replay(
  p_player_id uuid
) returns table (new_race_id uuid)
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

  -- Find an open race that isn't full and isn't the one they just finished
  select r.* into v_race
    from staff_sprint_races r
   where r.session_id = v_session.id and r.status = 'waiting'
     and r.id <> coalesce(v_player.race_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and (select count(*) from staff_sprint_players p where p.race_id = r.id) < v_session.race_size
   order by r.race_number asc
   limit 1
   for update;

  if not found then
    select coalesce(max(race_number), 0) + 1 into v_next_race_num
      from staff_sprint_races where session_id = v_session.id;
    insert into staff_sprint_races (session_id, race_number)
    values (v_session.id, v_next_race_num)
    returning * into v_race;
  end if;

  update staff_sprint_players
     set race_id = v_race.id, score = 0, incorrect = 0, status = 'waiting'
   where id = p_player_id;

  select count(*) into v_count from staff_sprint_players where race_id = v_race.id;
  if v_count >= v_session.race_size then
    update staff_sprint_races set status = 'active', started_at = now() where id = v_race.id;
    update staff_sprint_players set status = 'racing' where race_id = v_race.id;
  end if;

  return query select v_race.id;
end;
$$;

-- ============ RLS ============
-- Allow anonymous reads (everyone in classroom needs to see race state).
-- All writes go through SECURITY DEFINER RPCs above.

alter table staff_sprint_sessions enable row level security;
alter table staff_sprint_races enable row level security;
alter table staff_sprint_players enable row level security;

create policy "anon read sessions" on staff_sprint_sessions for select using (true);
create policy "anon read races" on staff_sprint_races for select using (true);
create policy "anon read players" on staff_sprint_players for select using (true);

grant execute on function staff_sprint_create_session(text, int, int) to anon, authenticated;
grant execute on function staff_sprint_join(text, text, text, text) to anon, authenticated;
grant execute on function staff_sprint_start_stalled(uuid, int, int) to anon, authenticated;
grant execute on function staff_sprint_submit_answer(uuid, boolean) to anon, authenticated;
grant execute on function staff_sprint_replay(uuid) to anon, authenticated;
