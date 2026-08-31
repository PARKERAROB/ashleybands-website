-- Repeat the browser-role revocations using the repository's canonical
-- privilege wording so the static and live security gates cover every new
-- Carnegie record before deployment.

revoke all privileges on table public.carnegie_trip_submissions from anon, authenticated;
revoke all privileges on table public.carnegie_trip_staff_tracking from anon, authenticated;
revoke all privileges on table public.carnegie_trip_refund_events from anon, authenticated;

notify pgrst, 'reload schema';
