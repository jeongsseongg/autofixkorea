create table public.autofix_consultations (
 id uuid primary key,
 created_at timestamptz not null default now(),
 form_type text not null,
 page text not null,
 fields jsonb not null,
 consent_version text not null,
 payload_hash text not null,
 ip_hash text not null,
 telegram_status text not null default 'pending' check (telegram_status in ('pending','sending','sent','failed')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 telegram_message_id text,
 last_error_code text
);
alter table public.autofix_consultations enable row level security;
revoke all on public.autofix_consultations from public,anon,authenticated;
grant select,insert,update on public.autofix_consultations to service_role;
create index autofix_consultations_ip_time on public.autofix_consultations(ip_hash,created_at);
create index autofix_consultations_pending on public.autofix_consultations(next_attempt_at) where telegram_status <> 'sent';

create function public.autofix_accept(p_id uuid,p_form text,p_page text,p_fields jsonb,p_consent text,p_hash text,p_ip text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.autofix_consultations; result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_ip,0));
 select * into existing from public.autofix_consultations where id=p_id;
 if found then
   if existing.payload_hash<>p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('id',existing.id,'telegram_status',existing.telegram_status);
 end if;
 if (select count(*) from public.autofix_consultations where ip_hash=p_ip and created_at>now()-interval '10 minutes')>=5 then
   raise exception 'RATE_LIMITED';
 end if;
 insert into public.autofix_consultations(id,form_type,page,fields,consent_version,payload_hash,ip_hash)
 values(p_id,p_form,p_page,p_fields,p_consent,p_hash,p_ip);
 return jsonb_build_object('id',p_id,'telegram_status','pending');
end $$;
revoke all on function public.autofix_accept(uuid,text,text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.autofix_accept(uuid,text,text,jsonb,text,text,text) to service_role;

create function public.autofix_claim(p_id uuid default null)
returns setof public.autofix_consultations language sql security invoker set search_path='' as $$
 update public.autofix_consultations c set telegram_status='sending',lease_until=now()+interval '90 seconds',attempts=attempts+1
 where c.id in (
 select id from public.autofix_consultations
 where (p_id is null or id=p_id) and telegram_status<>'sent' and attempts<10
 and next_attempt_at<=now() and (lease_until is null or lease_until<now())
 order by created_at for update skip locked limit 10
 ) returning c.*;
$$;
revoke all on function public.autofix_claim(uuid) from public,anon,authenticated;
grant execute on function public.autofix_claim(uuid) to service_role;
