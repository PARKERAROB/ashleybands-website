-- provenance: tighten inherited Supabase default privileges; no person records changed.
-- GRANT SELECT does not remove ALL granted by database default privileges.
revoke all on public.carnegie_workspace, public.carnegie_workspace_history from service_role;
grant select on public.carnegie_workspace, public.carnegie_workspace_history to service_role;
-- Mutations remain available only through save_carnegie_workspace, which atomically
-- appends history as its function owner. No public grants or policies are introduced.
