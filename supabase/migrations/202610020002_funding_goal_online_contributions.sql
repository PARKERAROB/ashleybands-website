-- #167: online family contributions toward the marching band funding goal settle through
-- the same audited path as fees. Only the kind check changes.

create or replace function public.settle_online_fee_payment_with_audit(
  p_payment_id uuid, p_capture_id text, p_actor_type text, p_actor_id text,
  p_actor_name text, p_route text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_method text;
  v_kind text;
  v_student_id uuid;
  v_amount_cents integer;
begin
  if p_actor_type not in ('parent','system') then raise exception 'invalid payment actor'; end if;
  if nullif(btrim(p_capture_id), '') is null then raise exception 'capture id required'; end if;
  select status, method, kind, student_id, amount_cents
    into v_status, v_method, v_kind, v_student_id, v_amount_cents
  from fee_payments where id = p_payment_id for update;
  if v_status is null then raise exception 'payment not found'; end if;
  if v_method <> 'paypal' or v_kind not in ('fee','funding_goal') then raise exception 'online fee or funding goal payment required'; end if;
  if v_status = 'completed' then return p_payment_id; end if;
  if v_status <> 'pending' then raise exception 'payment is not pending'; end if;

  update fee_payments set
    status = 'completed', paypal_capture_id = btrim(p_capture_id), received_at = now()
  where id = p_payment_id;
  insert into audit_log (actor_type, actor_id, actor_name, action, table_name, record_id, changes, route)
  values (
    p_actor_type, nullif(p_actor_id, ''), nullif(p_actor_name, ''), 'settle_online_payment',
    'fee_payments', p_payment_id::text,
    jsonb_build_object('student_id', v_student_id, 'amount_cents', v_amount_cents,
      'status', jsonb_build_object('old', v_status, 'new', 'completed')),
    p_route
  );
  return p_payment_id;
end;
$$;
revoke all on function public.settle_online_fee_payment_with_audit(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.settle_online_fee_payment_with_audit(uuid,text,text,text,text,text) to service_role;
