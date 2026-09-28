alter table public.autofix_accident_intakes
 add column if not exists telegram_status text not null default 'pending',
 add column if not exists telegram_sent_at timestamptz,
 add column if not exists telegram_message_id text,
 add column if not exists telegram_error text,
 add column if not exists telegram_claimed_at timestamptz;

create or replace function public.autofix_claim_telegram(p_id uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 update public.autofix_accident_intakes
 set telegram_status='sending',telegram_claimed_at=now()
 where id=p_id and status='complete'
 and (telegram_status='pending' or
 (telegram_status='sending' and telegram_claimed_at < now()-interval '5 minutes'));
 return found;
end $$;
revoke all on function public.autofix_claim_telegram(uuid) from public,anon,authenticated;
grant execute on function public.autofix_claim_telegram(uuid) to service_role;
