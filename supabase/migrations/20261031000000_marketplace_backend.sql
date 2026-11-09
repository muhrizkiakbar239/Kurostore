create type public.account_role as enum ('buyer', 'seller', 'admin');
create type public.seller_application_status as enum ('pending', 'approved', 'rejected');
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.order_status as enum ('pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.account_role not null default 'buyer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_name text not null check (char_length(store_name) between 2 and 80),
  store_description text not null default '' check (char_length(store_description) <= 500),
  status public.seller_application_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 500)
);

create unique index seller_applications_one_pending_per_user
  on public.seller_applications (user_id)
  where status = 'pending';

create table public.seller_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  store_name text not null check (char_length(store_name) between 2 and 80),
  store_slug text not null unique,
  store_description text not null default '' check (char_length(store_description) <= 500),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.categories (name, slug) values
  ('Elektronik', 'elektronik'),
  ('Makanan dan minuman', 'makanan-dan-minuman'),
  ('Tas dan aksesori', 'tas-dan-aksesori'),
  ('Kesehatan dan kecantikan', 'kesehatan-dan-kecantikan'),
  ('Baju pria', 'baju-pria'),
  ('Baju wanita', 'baju-wanita'),
  ('Sepatu pria', 'sepatu-pria'),
  ('Sepatu wanita', 'sepatu-wanita'),
  ('Hobi dan koleksi', 'hobi-dan-koleksi'),
  ('Merchandise', 'merchandise'),
  ('Voucher dan produk digital', 'voucher-dan-produk-digital'),
  ('Rumah dan gaya hidup', 'rumah-dan-gaya-hidup');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles (user_id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 2 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  price numeric(12, 2) not null check (price > 0),
  stock integer not null default 0 check (stock >= 0),
  status public.product_status not null default 'draft',
  sales_count integer not null default 0 check (sales_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_active_category_created on public.products (category_id, created_at desc) where status = 'active';
create index products_active_popular on public.products (sales_count desc, created_at desc) where status = 'active';

create table public.wishlist_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.cart_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  status public.order_status not null default 'pending',
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  shipping_address jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  seller_id uuid not null references public.seller_profiles (user_id) on delete restrict,
  product_name text not null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index order_items_seller_order on public.order_items (seller_id, order_id);

create table public.flash_sales (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.flash_sale_items (
  sale_id uuid not null references public.flash_sales (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sale_price numeric(12, 2) not null check (sale_price > 0),
  primary key (sale_id, product_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger cart_items_set_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.has_role(required_role public.account_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = required_role
  );
$$;

revoke all on function public.has_role(public.account_role) from public;
grant execute on function public.has_role(public.account_role) to anon, authenticated;

create or replace function public.bootstrap_first_admin(target_user_id uuid, expected_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('kurostore-bootstrap-first-admin'));

  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'ADMIN_ALREADY_EXISTS';
  end if;

  if not exists (
    select 1 from auth.users
    where id = target_user_id
      and lower(email) = lower(expected_email)
      and email_confirmed_at is not null
  ) then
    raise exception 'BOOTSTRAP_EMAIL_MISMATCH_OR_UNCONFIRMED';
  end if;

  update public.profiles
  set role = 'admin'
  where id = target_user_id
    and role = 'buyer';

  if not found then
    raise exception 'PROFILE_NOT_FOUND_OR_ROLE_NOT_ELIGIBLE';
  end if;
end;
$$;

create or replace function public.review_seller_application(
  target_application_id uuid,
  decision public.seller_application_status,
  reviewer_id uuid,
  decision_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.seller_applications%rowtype;
  safe_slug text;
begin
  if not exists (select 1 from public.profiles where id = reviewer_id and role = 'admin') then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  select * into application_record
  from public.seller_applications
  where id = target_application_id and status = 'pending'
  for update;

  if not found then
    raise exception 'APPLICATION_NOT_PENDING';
  end if;

  if decision = 'approved' then
    update public.profiles
    set role = 'seller'
    where id = application_record.user_id and role = 'buyer';

    if not found then
      raise exception 'APPLICANT_NOT_A_BUYER';
    end if;

    safe_slug := trim(both '-' from regexp_replace(lower(application_record.store_name), '[^a-z0-9]+', '-', 'g'));
    safe_slug := coalesce(nullif(safe_slug, ''), 'store') || '-' || substr(application_record.id::text, 1, 8);

    insert into public.seller_profiles (user_id, store_name, store_slug, store_description)
    values (application_record.user_id, application_record.store_name, safe_slug, application_record.store_description);

    update public.seller_applications
    set status = 'approved',
        reviewed_at = now(),
        reviewed_by = reviewer_id,
        rejection_reason = null
    where id = target_application_id;
  else
    update public.seller_applications
    set status = 'rejected',
        reviewed_at = now(),
        reviewed_by = reviewer_id,
        rejection_reason = nullif(trim(decision_reason), '')
    where id = target_application_id;
  end if;
end;
$$;

revoke all on function public.bootstrap_first_admin(uuid, text) from public, anon, authenticated;
revoke all on function public.review_seller_application(uuid, public.seller_application_status, uuid, text) from public, anon, authenticated;
grant execute on function public.bootstrap_first_admin(uuid, text) to service_role;
grant execute on function public.review_seller_application(uuid, public.seller_application_status, uuid, text) to service_role;

alter table public.profiles enable row level security;
alter table public.seller_applications enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.flash_sales enable row level security;
alter table public.flash_sale_items enable row level security;

create policy "Profiles are visible to their owner or admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_role('admin'));

create policy "Applicants can read their own applications"
  on public.seller_applications for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role('admin'));

create policy "Seller stores are publicly readable"
  on public.seller_profiles for select to anon, authenticated
  using (true);

create policy "Active categories are publicly readable"
  on public.categories for select to anon, authenticated
  using (is_active or public.has_role('admin'));
create policy "Admins manage categories"
  on public.categories for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy "Published products and owned products are readable"
  on public.products for select to anon, authenticated
  using (status = 'active' or seller_id = (select auth.uid()) or public.has_role('admin'));
create policy "Sellers create their own products"
  on public.products for insert to authenticated
  with check (seller_id = (select auth.uid()) and public.has_role('seller'));
create policy "Sellers update their own products"
  on public.products for update to authenticated
  using ((seller_id = (select auth.uid()) and public.has_role('seller')) or public.has_role('admin'))
  with check ((seller_id = (select auth.uid()) and public.has_role('seller')) or public.has_role('admin'));
create policy "Sellers or admins delete their own products"
  on public.products for delete to authenticated
  using ((seller_id = (select auth.uid()) and public.has_role('seller')) or public.has_role('admin'));

create policy "Users manage their own wishlist"
  on public.wishlist_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage their own cart"
  on public.cart_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Buyers and admins can read orders"
  on public.orders for select to authenticated
  using (buyer_id = (select auth.uid()) or public.has_role('admin'));
create policy "Buyers, relevant sellers, and admins can read order items"
  on public.order_items for select to authenticated
  using (
    public.has_role('admin')
    or seller_id = (select auth.uid())
    or exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.buyer_id = (select auth.uid())
    )
  );

create policy "Active flash sales are publicly readable"
  on public.flash_sales for select to anon, authenticated
  using ((is_active and starts_at <= now() and ends_at > now()) or public.has_role('admin'));
create policy "Flash sale products are publicly readable"
  on public.flash_sale_items for select to anon, authenticated
  using (
    public.has_role('admin')
    or exists (
      select 1 from public.flash_sales
      where flash_sales.id = flash_sale_items.sale_id
        and flash_sales.is_active
        and flash_sales.starts_at <= now()
        and flash_sales.ends_at > now()
    )
  );

grant select on public.profiles to authenticated;
grant select on public.seller_applications to authenticated;
grant select on public.seller_profiles to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select on public.products to anon, authenticated;
grant insert, delete on public.products to authenticated;
grant update (category_id, name, description, price, stock, status) on public.products to authenticated;
grant select, insert, update, delete on public.wishlist_items, public.cart_items to authenticated;
grant select on public.orders, public.order_items to authenticated;
grant select on public.flash_sales, public.flash_sale_items to anon, authenticated;
