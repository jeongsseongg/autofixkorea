-- All AutoFix identities and content are isolated from other Promotors applications.
create table public.autofix_dealers (
 user_id uuid primary key references auth.users(id),
 company text not null check (length(company) between 2 and 100),
 business_number text not null check (business_number ~ '^[0-9]{10}$'),
 status text not null default 'pending' check (status in ('pending','approved','suspended')),
 role text not null default 'dealer' check (role in ('dealer','admin')),
 created_at timestamptz not null default now()
);
create table public.autofix_listing_sources (
 id uuid primary key default gen_random_uuid(),
 channel text not null check (channel in ('email','telegram')),
 sender text not null check (length(sender) between 1 and 254),
 label text not null check (length(label) between 1 and 100),
 auto_publish boolean not null default false,
 enabled boolean not null default true,
 unique(channel,sender)
);
create table public.autofix_listing_inbox (
 id uuid primary key default gen_random_uuid(),
 channel text not null, event_id text not null, sender text not null,
 payload_hash text not null, raw_text text not null, listing_id uuid,
 created_at timestamptz not null default now(),
 unique(channel,event_id)
);
create table public.autofix_listings (
 id uuid primary key references public.autofix_listing_inbox(id),
 source_id uuid not null references public.autofix_listing_sources(id), group_id text,
 title text not null default '', year integer, mileage_km bigint, price_krw bigint,
 fuel text not null default '', accident_type text not null default '', region text not null default '',
 description text not null default '', photos jsonb not null default '[]',
 status text not null default 'review' check (status in ('review','published','sold','archived')),
 review_reasons jsonb not null default '[]',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (year is null or year between 1900 and 2100),
 check (mileage_km is null or mileage_km between 0 and 10000000),
 check (price_krw is null or price_krw between 0 and 100000000000),
 check (jsonb_typeof(photos)='array' and jsonb_array_length(photos)<=10),
 check (status not in ('published','sold') or
   (length(title)>0 and year is not null and mileage_km is not null and price_krw is not null
    and length(fuel)>0 and length(accident_type)>0 and length(region)>0 and jsonb_array_length(photos)>0))
);
create index autofix_listing_feed on public.autofix_listings(status,created_at desc);
create index autofix_listing_source on public.autofix_listings(source_id);
create unique index autofix_listing_group on public.autofix_listings(source_id,group_id) where group_id is not null;
alter table public.autofix_dealers enable row level security;
alter table public.autofix_listing_sources enable row level security;
alter table public.autofix_listing_inbox enable row level security;
alter table public.autofix_listings enable row level security;
revoke all on public.autofix_dealers,public.autofix_listing_sources,public.autofix_listing_inbox,public.autofix_listings from public,anon,authenticated;
grant select on public.autofix_dealers,public.autofix_listings to authenticated;
grant all on public.autofix_dealers,public.autofix_listing_sources,public.autofix_listing_inbox,public.autofix_listings to service_role;
create policy autofix_dealer_self on public.autofix_dealers for select to authenticated
 using(user_id=(select auth.uid()));
create policy autofix_approved_listing_read on public.autofix_listings for select to authenticated
 using(status in ('published','sold') and exists (
  select 1 from public.autofix_dealers d where d.user_id=(select auth.uid()) and d.status='approved'
 ));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('autofix-listing-photos','autofix-listing-photos',false,10485760,array['image/jpeg','image/png','image/webp']);
-- No browser Storage policy: the API checks current dealer approval before serving each image.
create function public.autofix_ingest_listing(p_channel text,p_event text,p_sender text,p_hash text,p_raw text,p_listing jsonb,p_album boolean,p_group text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.autofix_listing_sources; r public.autofix_listing_inbox; new_id uuid; group_lot uuid; publish boolean;
begin
 select * into s from public.autofix_listing_sources where channel=p_channel and sender=p_sender and enabled;
 if not found then raise exception 'SOURCE_NOT_ALLOWED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_channel||':'||p_sender||':'||coalesce(p_group,p_event),0));
 select * into r from public.autofix_listing_inbox where channel=p_channel and event_id=p_event;
 if found then
  if r.payload_hash<>p_hash then raise exception 'EVENT_CONFLICT'; end if;
  return jsonb_build_object('id',coalesce(r.listing_id,r.id),'duplicate',true);
 end if;
 insert into public.autofix_listing_inbox(channel,event_id,sender,payload_hash,raw_text)
 values(p_channel,p_event,p_sender,p_hash,p_raw) returning id into new_id;
 if p_group is not null then
  select id into group_lot from public.autofix_listings where source_id=s.id and group_id=p_group;
  if found then
   update public.autofix_listings set
    title=coalesce(nullif(p_listing->>'title',''),title),year=coalesce((p_listing->>'year')::integer,year),
    mileage_km=coalesce((p_listing->>'mileage_km')::bigint,mileage_km),price_krw=coalesce((p_listing->>'price_krw')::bigint,price_krw),
    fuel=coalesce(nullif(p_listing->>'fuel',''),fuel),accident_type=coalesce(nullif(p_listing->>'accident_type',''),accident_type),
    region=coalesce(nullif(p_listing->>'region',''),region),description=coalesce(nullif(p_listing->>'description',''),description),
    photos=photos||(p_listing->'photos'),review_reasons='["사진 묶음과 필수 정보 확인 필요"]'::jsonb,updated_at=now()
    where id=group_lot;
   update public.autofix_listing_inbox set listing_id=group_lot where id=new_id;
   return jsonb_build_object('id',group_lot,'duplicate',false,'grouped',true);
  end if;
 end if;
 publish:=s.auto_publish and not p_album and jsonb_array_length(p_listing->'review_reasons')=0;
 insert into public.autofix_listings(id,source_id,group_id,title,year,mileage_km,price_krw,fuel,accident_type,region,description,photos,status,review_reasons)
 values(new_id,s.id,p_group,p_listing->>'title',(p_listing->>'year')::integer,(p_listing->>'mileage_km')::bigint,
 (p_listing->>'price_krw')::bigint,p_listing->>'fuel',p_listing->>'accident_type',p_listing->>'region',
 p_listing->>'description',p_listing->'photos',case when publish then 'published' else 'review' end,p_listing->'review_reasons');
 update public.autofix_listing_inbox set listing_id=new_id where id=new_id;
 return jsonb_build_object('id',new_id,'duplicate',false,'status',case when publish then 'published' else 'review' end);
end $$;
revoke all on function public.autofix_ingest_listing(text,text,text,text,text,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.autofix_ingest_listing(text,text,text,text,text,jsonb,boolean,text) to service_role;
