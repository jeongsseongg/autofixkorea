-- Run with migration in a transaction. Every synthetic row is rolled back.
do $$
declare a jsonb; d jsonb; token text; i integer; denied boolean; f record;
begin
 begin
  insert into public.ofa_admins(password_hash) values(extensions.crypt('synthetic-only-password',extensions.gen_salt('bf')));
  a:=public.ofa_admin_login('synthetic-only-password');
  assert a->>'role'='admin','admin login';
  d:=public.ofa_upsert_dealer(a->>'token','{"login_id":"test-regression-only","name":"검증용","password":"synthetic-dealer-password"}'::jsonb);
  d:=public.ofa_dealer_login('TEST-REGRESSION-ONLY','synthetic-dealer-password');
  token:=d->>'token';
  assert public.ofa_validate_session(token)->>'role'='dealer','dealer session';
  denied:=false;
  begin perform public.ofa_upsert_dealer(token,'{}'); exception when others then denied:=sqlerrm='ADMIN_ONLY'; end;
  assert denied,'dealer cannot create accounts';
  update public.ofa_dealers set status='suspended' where login_id='test-regression-only';
  denied:=false;
  begin perform public.ofa_validate_session(token); exception when others then denied:=sqlerrm='INVALID_SESSION'; end;
  assert denied,'suspension revokes current token';
  denied:=false;
  begin perform public.ofa_dealer_login('test-regression-only','synthetic-dealer-password'); exception when others then denied:=sqlerrm='INVALID_DEALER_LOGIN'; end;
  assert denied,'suspended login rejected';
  update public.ofa_dealers set status='approved' where login_id='test-regression-only';
  assert not exists(select 1 from public.ofa_sessions where ofa_sessions.token=token),'resuming cannot restore old token';
  d:=public.ofa_dealer_login('test-regression-only','synthetic-dealer-password');
  perform public.ofa_logout(d->>'token');
  denied:=false;
  begin perform public.ofa_validate_session(d->>'token'); exception when others then denied:=sqlerrm='INVALID_SESSION'; end;
  assert denied,'logout revokes token';
  denied:=false;
  begin perform public.ofa_secure_bootstrap('synthetic-only-password','wrong-code'); exception when others then denied:=sqlerrm='INVALID_SETUP_CODE'; end;
  assert denied,'bootstrap protected';
  for i in 1..30 loop assert public.ofa_login_attempt('regression-test'); end loop;
  assert not public.ofa_login_attempt('regression-test'),'rate limit';
  for f in select oid from pg_proc where pronamespace='public'::regnamespace and proname like 'ofa_%' loop
   assert not has_function_privilege('anon',f.oid,'EXECUTE'),'anonymous RPC denied';
   assert not has_function_privilege('authenticated',f.oid,'EXECUTE'),'browser RPC denied';
  end loop;
  assert not has_table_privilege('authenticated','public.autofix_listings','SELECT'),'direct listing reads denied';
  raise exception using errcode='ZX001',message='rollback synthetic fixtures';
 exception when sqlstate 'ZX001' then null;
 end;
end $$;
