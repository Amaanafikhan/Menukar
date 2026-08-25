-- ============================================================
-- MENUKAR — schema + row level security
-- Run this in Supabase → SQL Editor → New query → Run
-- ============================================================

-- ---------- tables ----------

-- an account is the billing/brand root: one independent restaurant,
-- or one hotel that owns several outlets underneath it
create table if not exists accounts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 80),
  kind         text not null default 'restaurant' check (kind in ('restaurant','hotel')),
  is_suspended boolean not null default false,
  created_at   timestamptz not null default now()
);

-- who can act on an account, and how much they can do
create table if not exists memberships (
  account_id  uuid not null references accounts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner','manager','staff')),
  created_at  timestamptz not null default now(),
  primary key (account_id, user_id)
);

-- platform team, not tenant staff — grants access to /admin
create table if not exists platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists restaurants (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  tagline     text check (char_length(tagline) <= 120),
  address     text check (char_length(address) <= 200),
  phone       text check (char_length(phone) <= 20),
  template    text not null default 'tiffin' check (template in ('tiffin','slate')),
  is_open     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  note          text check (char_length(note) <= 60),
  position      int  not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  description   text check (char_length(description) <= 160),
  -- price stored in paise: integer maths, no floating point money bugs
  price_paise   int  not null check (price_paise >= 0 and price_paise <= 10000000),
  is_veg        boolean not null default true,
  is_available  boolean not null default true,
  position      int  not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists banners (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 60),
  subtitle      text check (char_length(subtitle) <= 120),
  style         text not null default 'a' check (style in ('a','b','c')),
  is_active     boolean not null default true,
  position      int  not null default 0,
  created_at    timestamptz not null default now()
);

-- lightweight scan counter; one row per restaurant per day
create table if not exists scans (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  day           date not null default current_date,
  count         int  not null default 0,
  primary key (restaurant_id, day)
);

create index if not exists idx_items_restaurant   on items(restaurant_id);
create index if not exists idx_items_category     on items(category_id);
create index if not exists idx_categories_rest    on categories(restaurant_id);
create index if not exists idx_banners_rest       on banners(restaurant_id);
create index if not exists idx_restaurants_slug   on restaurants(slug);
create index if not exists idx_restaurants_acct   on restaurants(account_id);
create index if not exists idx_memberships_user   on memberships(user_id);

-- ---------- helpers ----------

-- does this account belong to the caller (any role)?
create or replace function is_member(aid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships m
    where m.account_id = aid and m.user_id = auth.uid()
  );
$$;

-- can the caller write to this account (owner/manager, not read-only staff)?
create or replace function can_manage(aid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships m
    where m.account_id = aid and m.user_id = auth.uid()
      and m.role in ('owner','manager')
  );
$$;

-- is the caller specifically an owner (not just manager/staff) of this account?
create or replace function is_account_owner(aid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships m
    where m.account_id = aid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- does this restaurant belong to an account the caller can manage?
create or replace function owns_restaurant(rid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from restaurants r
    where r.id = rid and can_manage(r.account_id)
  );
$$;

create or replace function is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from platform_admins a where a.user_id = auth.uid());
$$;

-- ---------- enable RLS on everything ----------

alter table accounts        enable row level security;
alter table memberships     enable row level security;
alter table platform_admins enable row level security;
alter table restaurants     enable row level security;
alter table categories      enable row level security;
alter table items           enable row level security;
alter table banners         enable row level security;
alter table scans           enable row level security;

-- ---------- accounts ----------
-- no public read: an account's name/kind is internal, only members and
-- platform admins need it. the public menu page reads `restaurants` directly.

drop policy if exists accounts_member_read on accounts;
create policy accounts_member_read on accounts
  for select using (is_member(id) or is_platform_admin());

-- no client-side insert policy: creating an account happens only through
-- create_account_with_outlet() below, which runs as security definer and
-- sidesteps the bootstrap chicken-and-egg of RLS needing a membership row
-- that can't exist until the account it points to does.
drop policy if exists accounts_self_insert on accounts;

drop policy if exists accounts_owner_update on accounts;
create policy accounts_owner_update on accounts
  for update using (can_manage(id) or is_platform_admin())
             with check (can_manage(id) or is_platform_admin());

-- ---------- memberships ----------
-- members can see who else is on their account; only owners add/remove people

drop policy if exists memberships_member_read on memberships;
create policy memberships_member_read on memberships
  for select using (is_member(account_id) or is_platform_admin());

-- routed through is_account_owner() (security definer) instead of an inline
-- subquery on memberships — a raw self-referencing subquery here forces
-- Postgres to re-evaluate this table's RLS while already evaluating it,
-- which Postgres detects and rejects outright: "infinite recursion detected
-- in policy for relation memberships" (42P17). the security-definer function
-- runs as the elevated function owner, which bypasses RLS entirely, so no
-- recursive re-check happens.
drop policy if exists memberships_owner_write on memberships;
create policy memberships_owner_write on memberships
  for all using (is_account_owner(account_id) or is_platform_admin())
  with check (is_account_owner(account_id) or is_platform_admin());

-- no client-side bootstrap policy either: the first membership row is
-- created inside create_account_with_outlet() (security definer), not by
-- a direct client insert, so there's no chicken-and-egg to police here.
drop policy if exists memberships_self_bootstrap on memberships;

-- ---------- platform_admins ----------
-- only readable by admins themselves; no client-side writes at all —
-- granting admin access is a manual step run from the Supabase SQL editor

drop policy if exists platform_admins_self_read on platform_admins;
create policy platform_admins_self_read on platform_admins
  for select using (user_id = auth.uid());

-- ---------- restaurants ----------
-- public may read (the menu page is public); only account managers may write

drop policy if exists restaurants_public_read on restaurants;
create policy restaurants_public_read on restaurants
  for select using (true);

drop policy if exists restaurants_owner_insert on restaurants;
create policy restaurants_owner_insert on restaurants
  for insert with check (can_manage(account_id));

drop policy if exists restaurants_owner_update on restaurants;
create policy restaurants_owner_update on restaurants
  for update using (can_manage(account_id) or is_platform_admin())
             with check (can_manage(account_id) or is_platform_admin());

drop policy if exists restaurants_owner_delete on restaurants;
create policy restaurants_owner_delete on restaurants
  for delete using (can_manage(account_id));

-- ---------- categories ----------

drop policy if exists categories_public_read on categories;
create policy categories_public_read on categories
  for select using (true);

drop policy if exists categories_owner_write on categories;
create policy categories_owner_write on categories
  for all using (owns_restaurant(restaurant_id))
          with check (owns_restaurant(restaurant_id));

-- ---------- items ----------

drop policy if exists items_public_read on items;
create policy items_public_read on items
  for select using (true);

drop policy if exists items_owner_write on items;
create policy items_owner_write on items
  for all using (owns_restaurant(restaurant_id))
          with check (owns_restaurant(restaurant_id));

-- ---------- banners ----------

drop policy if exists banners_public_read on banners;
create policy banners_public_read on banners
  for select using (true);

drop policy if exists banners_owner_write on banners;
create policy banners_owner_write on banners
  for all using (owns_restaurant(restaurant_id))
          with check (owns_restaurant(restaurant_id));

-- ---------- scans ----------
-- owner reads their own numbers; nobody writes directly (see rpc below)

drop policy if exists scans_owner_read on scans;
create policy scans_owner_read on scans
  for select using (owns_restaurant(restaurant_id) or is_platform_admin());

-- counted through a security-definer function so an anonymous visitor
-- can bump the counter without being able to read or edit anything
create or replace function record_scan(rid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into scans (restaurant_id, day, count)
  values (rid, current_date, 1)
  on conflict (restaurant_id, day)
  do update set count = scans.count + 1;
end;
$$;

grant execute on function record_scan(uuid) to anon, authenticated;

-- ---------- first-time signup: account + owner membership + first outlet ----------
-- runs as one security-definer transaction so RLS never has to referee the
-- bootstrap moment (an account with no members yet, a user with no account yet).
-- on a slug collision the whole thing rolls back — nothing orphaned to clean up.

create or replace function create_account_with_outlet(
  p_account_name text,
  p_outlet_name  text,
  p_slug         text,
  p_tagline      text default null
)
returns table (restaurant_id uuid, restaurant_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account   uuid;
  new_outlet    uuid;
  existing_rest record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- idempotency guard: a user who already has an account should get their
  -- existing first outlet back, not a second account. covers double-clicks,
  -- retried requests, and a stale client re-submitting after a slow response.
  select r.id, r.slug into existing_rest
  from memberships m
  join restaurants r on r.account_id = m.account_id
  where m.user_id = auth.uid()
  order by r.created_at asc
  limit 1;

  if found then
    return query select existing_rest.id, existing_rest.slug;
    return;
  end if;

  insert into accounts (name) values (p_account_name) returning id into new_account;

  insert into memberships (account_id, user_id, role)
    values (new_account, auth.uid(), 'owner');

  insert into restaurants (account_id, name, slug, tagline)
    values (new_account, p_outlet_name, p_slug, p_tagline)
    returning id into new_outlet;

  insert into categories (restaurant_id, name, note, position) values
    (new_outlet, 'Breakfast', '7 – 11:30 AM', 0),
    (new_outlet, 'Main course', '12 PM onwards', 1),
    (new_outlet, 'Beverages', 'All day', 2);

  return query select new_outlet, p_slug;
exception
  when unique_violation then
    -- slug already taken — let the caller retry with a different candidate;
    -- the whole transaction (account + membership included) rolls back
    raise exception 'slug_taken' using errcode = '23505';
end;
$$;

grant execute on function create_account_with_outlet(text, text, text, text) to authenticated;

-- adding an outlet to an *existing* account: no bootstrap problem here since
-- the caller already has a membership, so restaurants_owner_insert covers it
-- directly — this one's just for convenience/atomicity with its categories.
create or replace function add_outlet(
  p_account_id uuid,
  p_outlet_name text,
  p_slug        text
)
returns table (restaurant_id uuid, restaurant_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_outlet uuid;
begin
  if not can_manage(p_account_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into restaurants (account_id, name, slug)
    values (p_account_id, p_outlet_name, p_slug)
    returning id into new_outlet;

  insert into categories (restaurant_id, name, position) values (new_outlet, 'Menu', 0);

  return query select new_outlet, p_slug;
exception
  when unique_violation then
    raise exception 'slug_taken' using errcode = '23505';
end;
$$;

grant execute on function add_outlet(uuid, text, text) to authenticated;

-- ---------- keep updated_at honest ----------

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_restaurants_touch on restaurants;
create trigger trg_restaurants_touch
  before update on restaurants
  for each row execute function touch_updated_at();
