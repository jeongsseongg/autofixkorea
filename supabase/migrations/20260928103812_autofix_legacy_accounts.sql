-- Adapted from the existing AutoFix operational SQL; no historical account rows are included.


create extension if not exists pgcrypto;

create table if not exists public.ofa_admins (
  id uuid primary key default gen_random_uuid(),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ofa_dealers (
  id uuid primary key default gen_random_uuid(),
  login_id text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ofa_dealers add column if not exists status text not null default 'approved' check (status in ('approved','suspended'));

create table if not exists public.ofa_sessions (
  token text primary key,
  role text not null check (role in ('admin', 'dealer')),
  account_id uuid not null,
  account_name text not null,
  login_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours')
);



create or replace function public.ofa_session_row(p_token text)
returns public.ofa_sessions
language sql
security invoker
set search_path = public, extensions
stable
as $$
  select s.*
  from public.ofa_sessions s
  where token = p_token
    and expires_at > now()
    and ((s.role='admin' and exists(select 1 from public.ofa_admins a where a.id=s.account_id))
      or (s.role='dealer' and exists(select 1 from public.ofa_dealers d where d.id=s.account_id and d.status='approved')))
  limit 1
$$;

create or replace function public.ofa_issue_session(
  p_role text,
  p_account_id uuid,
  p_account_name text,
  p_login_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_token text;
begin
  delete from public.ofa_sessions where expires_at <= now();
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.ofa_sessions (
    token, role, account_id, account_name, login_id, expires_at
  ) values (
    v_token, p_role, p_account_id, p_account_name, p_login_id, now() + interval '8 hours'
  );

  return jsonb_build_object(
    'token', v_token,
    'role', p_role,
    'account_id', p_account_id,
    'account_name', p_account_name,
    'login_id', p_login_id
  );
end;
$$;

create or replace function public.ofa_admin_status()
returns jsonb
language sql
security invoker
set search_path = public, extensions
stable
as $$
  select jsonb_build_object('exists', exists(select 1 from public.ofa_admins))
$$;

create or replace function public.ofa_admin_bootstrap(p_password text)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_admin public.ofa_admins;
begin
  perform pg_advisory_xact_lock(hashtext('ofa_admin_bootstrap'));
  if exists(select 1 from public.ofa_admins) then
    raise exception 'ADMIN_EXISTS';
  end if;
  if coalesce(length(trim(p_password)), 0) < 8 then
    raise exception 'INVALID_PASSWORD';
  end if;

  insert into public.ofa_admins(password_hash)
  values (crypt(p_password, gen_salt('bf')))
  returning * into v_admin;

  return public.ofa_issue_session('admin', v_admin.id, 'admin', 'admin');
end;
$$;

create or replace function public.ofa_admin_login(p_password text)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_admin public.ofa_admins;
begin
  select *
  into v_admin
  from public.ofa_admins
  where password_hash = crypt(p_password, password_hash)
  limit 1;

  if v_admin.id is null then
    raise exception 'INVALID_ADMIN_PASSWORD';
  end if;

  return public.ofa_issue_session('admin', v_admin.id, 'admin', 'admin');
end;
$$;

create or replace function public.ofa_validate_session(p_token text)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_session public.ofa_sessions;
begin
  select * into v_session from public.ofa_session_row(p_token);
  if v_session.token is null then
    raise exception 'INVALID_SESSION';
  end if;

  update public.ofa_sessions
  set expires_at = now() + interval '8 hours'
  where token = p_token;

  return jsonb_build_object(
    'token', v_session.token,
    'role', v_session.role,
    'account_id', v_session.account_id,
    'account_name', v_session.account_name,
    'login_id', v_session.login_id
  );
end;
$$;

create or replace function public.ofa_logout(p_token text)
returns boolean
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  delete from public.ofa_sessions where token = p_token;
  return true;
end;
$$;

create or replace function public.ofa_admin_change_password(
  p_token text,
  p_new_password text
)
returns boolean
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_session public.ofa_sessions;
begin
  select * into v_session from public.ofa_session_row(p_token);
  if v_session.token is null or v_session.role <> 'admin' then
    raise exception 'ADMIN_ONLY';
  end if;
  if coalesce(length(trim(p_new_password)), 0) < 8 then
    raise exception 'INVALID_PASSWORD';
  end if;

  update public.ofa_admins
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where id = v_session.account_id;

  return true;
end;
$$;

create or replace function public.ofa_dealer_login(
  p_login_id text,
  p_password text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_dealer public.ofa_dealers;
begin
  select *
  into v_dealer
  from public.ofa_dealers
  where lower(login_id) = lower(trim(p_login_id)) and status='approved'
    and password_hash = crypt(p_password, password_hash)
  limit 1;

  if v_dealer.id is null then
    raise exception 'INVALID_DEALER_LOGIN';
  end if;

  return public.ofa_issue_session('dealer', v_dealer.id, v_dealer.name, v_dealer.login_id);
end;
$$;

create or replace function public.ofa_list_dealers(p_token text)
returns table (
  id uuid,
  login_id text,
  name text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_session public.ofa_sessions;
begin
  select * into v_session from public.ofa_session_row(p_token);
  if v_session.token is null or v_session.role <> 'admin' then
    raise exception 'ADMIN_ONLY';
  end if;

  return query
  select d.id, d.login_id, d.name, d.created_at, d.updated_at
  from public.ofa_dealers d
  order by d.name asc, d.created_at desc;
end;
$$;

create or replace function public.ofa_upsert_dealer(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_session public.ofa_sessions;
  v_dealer_id uuid;
  v_login_id text;
  v_name text;
  v_password text;
  v_dealer public.ofa_dealers;
begin
  select * into v_session from public.ofa_session_row(p_token);
  if v_session.token is null or v_session.role <> 'admin' then
    raise exception 'ADMIN_ONLY';
  end if;

  v_dealer_id := nullif(p_payload->>'id', '')::uuid;
  v_login_id := lower(trim(coalesce(p_payload->>'login_id', '')));
  v_name := trim(coalesce(p_payload->>'name', ''));
  v_password := coalesce(p_payload->>'password', '');

  if v_login_id = '' then
    raise exception 'DEALER_LOGIN_REQUIRED';
  end if;
  if char_length(v_password) < 8 then
    raise exception 'INVALID_PASSWORD';
  end if;
  if v_name = '' then
    v_name := v_login_id;
  end if;

  if v_dealer_id is null then
    select *
    into v_dealer
    from public.ofa_dealers
    where login_id = v_login_id
    limit 1;
  else
    select *
    into v_dealer
    from public.ofa_dealers
    where id = v_dealer_id
    limit 1;
  end if;

  if v_dealer.id is null then
    insert into public.ofa_dealers(login_id, name, password_hash)
    values (v_login_id, v_name, crypt(v_password, gen_salt('bf')))
    returning * into v_dealer;
  else
    update public.ofa_dealers
    set login_id = v_login_id,
        name = v_name,
        password_hash = crypt(v_password, gen_salt('bf'))
    where id = v_dealer.id
    returning * into v_dealer;
  end if;

  return jsonb_build_object(
    'id', v_dealer.id,
    'login_id', v_dealer.login_id,
    'name', v_dealer.name
  );
end;
$$;

create table public.ofa_login_limits (
  key text primary key, attempts integer not null default 0, window_start timestamptz not null default now()
);
create table public.ofa_setup_config (id boolean primary key default true check(id), code_hash text not null);

create function public.ofa_login_attempt(p_key text) returns boolean
language plpgsql security invoker set search_path=public,extensions as $$
declare n integer;
begin
  insert into public.ofa_login_limits(key,attempts) values(left(p_key,100),1)
  on conflict(key) do update set
    attempts=case when ofa_login_limits.window_start < now()-interval '15 minutes' then 1 else ofa_login_limits.attempts+1 end,
    window_start=case when ofa_login_limits.window_start < now()-interval '15 minutes' then now() else ofa_login_limits.window_start end
  returning attempts into n;
  return n <= 30;
end $$;

create function public.ofa_secure_bootstrap(p_password text,p_code text) returns jsonb
language plpgsql security invoker set search_path=public,extensions as $$
begin
  if not exists(select 1 from public.ofa_setup_config where code_hash=encode(digest(p_code,'sha256'),'hex')) then
    raise exception 'INVALID_SETUP_CODE';
  end if;
  return public.ofa_admin_bootstrap(p_password);
end $$;

-- Custom account sessions go through the Edge API only. No direct browser RPCs.
alter table public.ofa_admins enable row level security;
alter table public.ofa_dealers enable row level security;
alter table public.ofa_sessions enable row level security;
alter table public.ofa_login_limits enable row level security;
alter table public.ofa_setup_config enable row level security;
revoke all on public.ofa_admins,public.ofa_dealers,public.ofa_sessions,public.ofa_login_limits,public.ofa_setup_config from public,anon,authenticated;
grant all on public.ofa_admins,public.ofa_dealers,public.ofa_sessions,public.ofa_login_limits,public.ofa_setup_config to service_role;
revoke select on public.autofix_listings,public.autofix_dealers from authenticated;
revoke all on function public.ofa_session_row(text) from public,anon,authenticated;
grant execute on function public.ofa_session_row(text) to service_role;
revoke all on function public.ofa_issue_session(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ofa_issue_session(text,uuid,text,text) to service_role;
revoke all on function public.ofa_admin_status() from public,anon,authenticated;
grant execute on function public.ofa_admin_status() to service_role;
revoke all on function public.ofa_admin_bootstrap(text) from public,anon,authenticated;
grant execute on function public.ofa_admin_bootstrap(text) to service_role;
revoke all on function public.ofa_admin_login(text) from public,anon,authenticated;
grant execute on function public.ofa_admin_login(text) to service_role;
revoke all on function public.ofa_validate_session(text) from public,anon,authenticated;
grant execute on function public.ofa_validate_session(text) to service_role;
revoke all on function public.ofa_logout(text) from public,anon,authenticated;
grant execute on function public.ofa_logout(text) to service_role;
revoke all on function public.ofa_admin_change_password(text,text) from public,anon,authenticated;
grant execute on function public.ofa_admin_change_password(text,text) to service_role;
revoke all on function public.ofa_dealer_login(text,text) from public,anon,authenticated;
grant execute on function public.ofa_dealer_login(text,text) to service_role;
revoke all on function public.ofa_list_dealers(text) from public,anon,authenticated;
grant execute on function public.ofa_list_dealers(text) to service_role;
revoke all on function public.ofa_upsert_dealer(text,jsonb) from public,anon,authenticated;
grant execute on function public.ofa_upsert_dealer(text,jsonb) to service_role;
revoke all on function public.ofa_login_attempt(text) from public,anon,authenticated;
grant execute on function public.ofa_login_attempt(text) to service_role;
revoke all on function public.ofa_secure_bootstrap(text,text) from public,anon,authenticated;
grant execute on function public.ofa_secure_bootstrap(text,text) to service_role;

create function public.ofa_revoke_changed_sessions() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if new.password_hash is distinct from old.password_hash or new.status is distinct from old.status then
    delete from public.ofa_sessions where role='dealer' and account_id=new.id;
  end if;
  return new;
end $$;
create trigger ofa_dealer_session_change after update on public.ofa_dealers
for each row execute function public.ofa_revoke_changed_sessions();
revoke all on function public.ofa_revoke_changed_sessions() from public,anon,authenticated;
grant execute on function public.ofa_revoke_changed_sessions() to service_role;
-- Schema backup: ../tmp/autofix-listing-schema-before-legacy.sql (outside repository).
alter table public.autofix_listing_sources drop constraint autofix_listing_sources_channel_check;
alter table public.autofix_listing_sources add constraint autofix_listing_sources_channel_check check(channel in ('email','telegram','manual'));
insert into public.autofix_listing_sources(channel,sender,label,auto_publish) values('manual','admin','관리자 직접 등록',false);
