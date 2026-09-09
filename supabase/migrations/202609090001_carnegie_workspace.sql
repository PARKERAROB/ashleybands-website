-- provenance: explicit staff-authored workspace entries and reviewed uploads.
-- No memberships or private project facts are seeded by this migration.
create table public.carnegie_workspace_members (
  staff_id uuid primary key references public.staff(id),
  domains text[] not null default '{coordination}' check (domains <@ array['program','finance','coordination']::text[]),
  source text not null,
  created_at timestamptz not null default now()
);
create table public.carnegie_workspace (
  id boolean primary key default true check (id),
  primary_owner_id uuid references public.staff(id),
  revision integer not null default 0,
  state jsonb not null default '{"records":[],"proposals":[],"commitments":[],"documents":[]}',
  updated_at timestamptz not null default now(),
  check (octet_length(state::text) <= 4000000)
);
create table public.carnegie_workspace_history (
  revision integer primary key,
  actor_id uuid not null references public.staff(id),
  action text not null,
  source text not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.carnegie_workspace_members enable row level security;
alter table public.carnegie_workspace enable row level security;
alter table public.carnegie_workspace_history enable row level security;
revoke all on public.carnegie_workspace_members, public.carnegie_workspace, public.carnegie_workspace_history from anon, authenticated;
grant select, insert, update on public.carnegie_workspace_members to service_role;
grant select on public.carnegie_workspace, public.carnegie_workspace_history to service_role;
insert into public.carnegie_workspace(id) values(true);

-- Service-only atomic compare-and-swap plus mandatory immutable history.
create function public.save_carnegie_workspace(p_revision integer, p_state jsonb, p_actor uuid, p_action text, p_source text)
returns integer language plpgsql security definer set search_path = public as $$
declare next_revision integer;
begin
  if not exists (select 1 from staff s where s.id=p_actor and s.disabled_at is null
    and ((s.role='director' and s.id=(select primary_owner_id from carnegie_workspace where id=true)) or exists(select 1 from carnegie_workspace_members m where m.staff_id=s.id))) then
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

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('carnegie-workspace','carnegie-workspace',false,3000000,array[
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;
-- No storage.objects policies: only the authorized server may read/write.
