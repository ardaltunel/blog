begin;

set local role anon;
do $$
begin
 if has_table_privilege('anon','public.authors','select') then raise exception 'Public author metadata exposed'; end if;
 if has_table_privilege('anon','public.posts','insert') then raise exception 'Public write grant'; end if;
 if has_function_privilege('anon','public.list_admin_users()','execute') then raise exception 'Public email RPC'; end if;
 if exists(select 1 from public.posts where not is_verified) then raise exception 'Drafts exposed'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$
begin
 if private.is_current_user_admin() then raise exception 'Unknown user is admin'; end if;
 if exists(select 1 from public.list_admin_users()) then raise exception 'Member can read emails'; end if;
 if not has_table_privilege('authenticated','public.categories','insert') then raise exception 'Missing category grant'; end if;
 begin
  insert into public.authors(id,user_id,firstname,lastname,is_admin)
  values(-2147483647,auth.uid(),'Permission','Test',true);
  raise exception 'Role escalation was allowed';
 exception when raise_exception then
  if sqlerrm != 'Admin access cannot be self-assigned.' then raise; end if;
 end;
 begin
  insert into public.categories(id,title) values(-2147483647,'Permission test');
  raise exception 'Member category write was allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

rollback;

