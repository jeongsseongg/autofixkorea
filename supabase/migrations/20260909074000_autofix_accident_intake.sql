create table if not exists public.autofix_accident_intakes (
 id uuid primary key, token_hash text not null, payload_hash text not null, ip_hash text not null,
 values jsonb not null, photos jsonb not null, status text not null default 'uploading' check(status in ('uploading','complete')),
 created_at timestamptz not null default now(), completed_at timestamptz
);
alter table public.autofix_accident_intakes enable row level security;
revoke all on public.autofix_accident_intakes from public, anon, authenticated;
grant select,insert,update on public.autofix_accident_intakes to service_role;
create index if not exists autofix_accident_ip_time on public.autofix_accident_intakes(ip_hash,created_at);
create or replace function public.autofix_accident_start(p_id uuid,p_token text,p_hash text,p_ip text,p_values jsonb,p_photos jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.autofix_accident_intakes;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_ip,0));
 select * into r from public.autofix_accident_intakes where id=p_id;
 if found then
  if r.token_hash<>p_token or r.payload_hash<>p_hash then raise exception 'CONFLICT'; end if;
  return jsonb_build_object('id',r.id,'status',r.status);
 end if;
 if (select count(*) from public.autofix_accident_intakes where ip_hash=p_ip and created_at>now()-interval '10 minutes')>=5 then raise exception 'RATE_LIMITED'; end if;
 insert into public.autofix_accident_intakes(id,token_hash,payload_hash,ip_hash,values,photos) values(p_id,p_token,p_hash,p_ip,p_values,p_photos);
 return jsonb_build_object('id',p_id,'status','uploading');
end $$;
revoke all on function public.autofix_accident_start(uuid,text,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.autofix_accident_start(uuid,text,text,text,jsonb,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('autofix-accident-photos','autofix-accident-photos',false,20971520,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
