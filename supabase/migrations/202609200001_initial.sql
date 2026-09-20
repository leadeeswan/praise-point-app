-- Run once in Supabase SQL Editor. All objects are namespaced in public by table/function name.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('parent','child')),
  parent_id uuid references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  username text unique check (username ~ '^[a-z0-9_]{4,20}$'),
  age integer check (age between 1 and 19),
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  check ((role = 'parent' and parent_id is null and username is null and age is null) or
         (role = 'child' and parent_id is not null and username is not null and age is not null))
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 150),
  emoji text not null default '🎁' check (char_length(emoji) <= 12),
  price integer not null check (price between 1 and 100000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  price integer not null check(price > 0),
  status text not null default 'pending' check(status in ('pending','fulfilled')),
  created_at timestamptz not null default now()
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check(amount <> 0),
  reason text not null check(char_length(reason) between 1 and 200),
  created_at timestamptz not null default now()
);
create index profiles_parent_idx on public.profiles(parent_id);
create index products_parent_idx on public.products(parent_id);
create index transactions_family_idx on public.transactions(parent_id, created_at desc);
create index transactions_child_idx on public.transactions(child_id, created_at desc);
create index orders_family_idx on public.orders(parent_id, created_at desc);
create index orders_child_idx on public.orders(child_id, created_at desc);

-- Child role and owner are sourced exclusively from server-controlled app_metadata.
create function public.praise_handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'praise_role' = 'child' then
    if not exists(select 1 from public.profiles where id=(new.raw_app_meta_data->>'praise_parent_id')::uuid and role='parent') then
      raise exception 'Invalid parent';
    end if;
    insert into public.profiles(id,role,parent_id,name,username,age)
    values(new.id,'child',(new.raw_app_meta_data->>'praise_parent_id')::uuid,
      new.raw_user_meta_data->>'name',new.raw_app_meta_data->>'praise_username',
      (new.raw_user_meta_data->>'age')::integer);
  else
    if lower(new.email) like '%@children.praise.invalid' then
      raise exception 'Reserved child login address';
    end if;
    insert into public.profiles(id,role,name) values(new.id,'parent',
      left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'부모님'),30));
  end if;
  return new;
end;
$$;
create trigger praise_auth_user_created after insert on auth.users
for each row execute function public.praise_handle_new_user();
revoke all on function public.praise_handle_new_user() from public,anon,authenticated;

-- Non-recursive profile policies: children see themselves, parents see owned children.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.orders enable row level security;
create policy profiles_read on public.profiles for select to authenticated
using(id=(select auth.uid()) or parent_id=(select auth.uid()));
create policy products_read on public.products for select to authenticated
using(parent_id=(select auth.uid()) or exists(
  select 1 from public.profiles me where me.id=(select auth.uid()) and me.parent_id=products.parent_id));
create policy products_insert on public.products for insert to authenticated
with check(parent_id=(select auth.uid()) and exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.role='parent'));
create policy transactions_read on public.transactions for select to authenticated
using(child_id=(select auth.uid()) or parent_id=(select auth.uid()));
create policy orders_read on public.orders for select to authenticated
using(child_id=(select auth.uid()) or parent_id=(select auth.uid()));
revoke all on public.profiles,public.products,public.transactions,public.orders from anon,authenticated;
grant select on public.profiles,public.products,public.transactions,public.orders to authenticated;
grant insert on public.products to authenticated;

create function public.award_points(p_child uuid,p_amount integer,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
  if p_amount is null or p_amount not between 1 and 100000 then raise exception '포인트는 1~100,000 사이로 입력해주세요.'; end if;
  if p_reason is null or char_length(trim(p_reason)) not between 1 and 200 then raise exception '칭찬 이유를 입력해주세요.'; end if;
  update public.profiles set balance=balance+p_amount
    where id=p_child and parent_id=auth.uid() and role='child';
  if not found then raise exception '등록한 아이에게만 포인트를 줄 수 있어요.'; end if;
  insert into public.transactions(child_id,parent_id,amount,reason) values(p_child,auth.uid(),p_amount,trim(p_reason));
end;
$$;
create function public.buy_product(p_product uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare child public.profiles%rowtype; product public.products%rowtype; order_id uuid;
begin
  -- Serialize purchases for each child so concurrent requests cannot overspend.
  select * into child from public.profiles where id=auth.uid() and role='child' for update;
  if not found then raise exception '아이 계정으로 로그인해주세요.'; end if;
  select * into product from public.products where id=p_product and parent_id=child.parent_id and active for share;
  if not found then raise exception '구매할 수 없는 선물이에요.'; end if;
  if child.balance < product.price then raise exception '포인트가 부족해요.'; end if;
  update public.profiles set balance=balance-product.price where id=child.id;
  insert into public.orders(child_id,parent_id,product_id,product_name,price)
    values(child.id,child.parent_id,product.id,product.name,product.price) returning id into order_id;
  insert into public.transactions(child_id,parent_id,amount,reason)
    values(child.id,child.parent_id,-product.price,product.name||' 구매');
  return order_id;
end;
$$;
create function public.fulfill_order(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set status='fulfilled' where id=p_order and parent_id=auth.uid() and status='pending';
  if not found then raise exception '전달 대기 중인 우리 가족의 구매만 완료할 수 있어요.'; end if;
end;
$$;
revoke all on function public.award_points(uuid,integer,text), public.buy_product(uuid), public.fulfill_order(uuid) from public,anon;
grant execute on function public.award_points(uuid,integer,text), public.buy_product(uuid), public.fulfill_order(uuid) to authenticated;
