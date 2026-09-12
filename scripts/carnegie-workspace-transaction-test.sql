-- Synthetic database checks. The transaction rolls back all fixture/state writes.
begin;
do $$
declare actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); r integer; n integer;
begin
 insert into staff(id,email,pin_hash,display_name,role) values
 (actor,actor::text||'@example.com','not-a-login','Synthetic workspace owner','director'),
 (outsider,outsider::text||'@example.com','not-a-login','Synthetic other director','director');
 update carnegie_workspace set primary_owner_id=actor where id=true;
 select revision into r from carnegie_workspace where id=true;
 n:=save_carnegie_workspace(r,'{"records":[],"proposals":[],"commitments":[],"documents":[]}',actor,'test.save','Synthetic rollback-only proof');
 if n<>r+1 or not exists(select 1 from carnegie_workspace_history where revision=n and actor_id=actor) then raise exception 'Atomic history missing'; end if;
 begin
  perform save_carnegie_workspace(r,'{}',actor,'test.stale','Synthetic stale write');
  raise exception 'Stale write succeeded';
 exception when serialization_failure then null; end;
 begin
  perform save_carnegie_workspace(n,'{}',outsider,'test.denied','Synthetic out-of-scope director');
  raise exception 'Other director received implicit access';
 exception when insufficient_privilege then null; end;
 insert into carnegie_workspace_members(staff_id,domains,access,source) values(outsider,'{coordination}','viewer','Synthetic rollback-only viewer');
 begin
  perform save_carnegie_workspace(n,'{}',outsider,'test.viewer','Synthetic viewer denial');
  raise exception 'Viewer write succeeded';
 exception when insufficient_privilege then null; end;
 if has_table_privilege('anon','carnegie_workspace_agent_keys','select')
 or has_table_privilege('authenticated','carnegie_workspace_agent_keys','insert') then raise exception 'Public agent key access'; end if;
 if has_function_privilege('anon','save_carnegie_workspace(integer,jsonb,uuid,text,text)','execute')
 or has_function_privilege('authenticated','save_carnegie_workspace(integer,jsonb,uuid,text,text)','execute') then raise exception 'Public RPC access'; end if;
 if has_table_privilege('anon','carnegie_workspace','select') or has_table_privilege('authenticated','carnegie_workspace_history','select') then raise exception 'Public table access'; end if;
 if has_table_privilege('service_role','carnegie_workspace_history','update') or has_table_privilege('service_role','carnegie_workspace_history','delete') then raise exception 'Mutable history grants'; end if;
 if not exists(select 1 from storage.buckets where id='carnegie-workspace' and public=false) then raise exception 'Private bucket missing'; end if;
end $$;
rollback;
select 'PASS workspace atomic history, stale-save, viewer and other-director denial, private keys, public denial, and private bucket' as result;
