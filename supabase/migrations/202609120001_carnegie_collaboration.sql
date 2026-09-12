-- provenance: explicitly authorized workspace roles and self-issued agent credentials.
-- Existing members retain writer access; no new memberships or source claims are seeded.
alter table public.carnegie_workspace_members add column access text not null default 'writer' check (access in ('writer','viewer'));
create table public.carnegie_workspace_agent_keys (
  id uuid primary key,
  staff_id uuid not null references public.staff(id),
  token_hash text not null unique,
  label text not null check (length(label) between 1 and 80),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  source text not null
);
alter table public.carnegie_workspace_agent_keys enable row level security;
revoke all privileges on table public.carnegie_workspace_agent_keys from anon, authenticated;
revoke all privileges on table public.carnegie_workspace_members from anon, authenticated;
revoke all privileges on table public.carnegie_workspace from anon, authenticated;
revoke all privileges on table public.carnegie_workspace_history from anon, authenticated;
grant select, insert, update on public.carnegie_workspace_agent_keys to service_role;

create or replace function public.save_carnegie_workspace(p_revision integer, p_state jsonb, p_actor uuid, p_action text, p_source text)
returns integer language plpgsql security definer set search_path = public as $$
declare next_revision integer;
begin
  if not exists (select 1 from staff s where s.id=p_actor and s.disabled_at is null
    and ((s.role='director' and s.id=(select primary_owner_id from carnegie_workspace where id=true)) or exists(select 1 from carnegie_workspace_members m where m.staff_id=s.id and m.access='writer'))) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  update carnegie_workspace set state=p_state, revision=revision+1, updated_at=now()
    where id=true and revision=p_revision returning revision into next_revision;
  if next_revision is null then raise exception 'Workspace changed; refresh before saving' using errcode='40001'; end if;
  insert into carnegie_workspace_history(revision,actor_id,action,source,state)
    values(next_revision,p_actor,p_action,p_source,p_state);
  return next_revision;
end $$;
revoke all on function public.save_carnegie_workspace(integer,jsonb,uuid,text,text) from public, anon, authenticated;
grant execute on function public.save_carnegie_workspace(integer,jsonb,uuid,text,text) to service_role;
