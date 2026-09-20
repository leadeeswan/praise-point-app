-- Preserve existing accounts; defer profile creation until trusted metadata is ready.
begin;
create or replace function public.praise_handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare account auth.users%rowtype;
begin
  -- GoTrue inserts the user, then updates trusted app_metadata in the same transaction.
  -- A deferred trigger must read the final row: NEW still contains the insert snapshot.
  select * into account from auth.users where id = new.id;
  if not found then return new; end if;
  if account.raw_app_meta_data->>'praise_role' = 'child' then
    if not exists(select 1 from public.profiles where id=(account.raw_app_meta_data->>'praise_parent_id')::uuid and role='parent') then
      raise exception 'Invalid parent';
    end if;
    insert into public.profiles(id,role,parent_id,name,username,age)
    values(new.id,'child',(account.raw_app_meta_data->>'praise_parent_id')::uuid,
      account.raw_user_meta_data->>'name',account.raw_app_meta_data->>'praise_username',
      (account.raw_user_meta_data->>'age')::integer);
  else
    if lower(account.email) like '%@children.praise.invalid' then
      raise exception 'Reserved child login address';
    end if;
    insert into public.profiles(id,role,name) values(new.id,'parent',
      left(coalesce(nullif(trim(account.raw_user_meta_data->>'name'),''),'부모님'),30));
  end if;
  return new;
end;
$$;
drop trigger praise_auth_user_created on auth.users;
create constraint trigger praise_auth_user_created after insert on auth.users
deferrable initially deferred
for each row execute function public.praise_handle_new_user();
revoke all on function public.praise_handle_new_user() from public,anon,authenticated;

commit;
