alter table public.products
  add column price_is_estimate boolean not null default false;

update public.products
set price_is_estimate = true
from public.seller_profiles
where products.seller_id = seller_profiles.user_id
  and seller_profiles.store_slug = 'kurostore-demo';

alter table public.order_items
  add column price_is_estimate boolean not null default false;

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index product_reviews_product_created
  on public.product_reviews (product_id, created_at desc);

create trigger product_reviews_set_updated_at before update on public.product_reviews
  for each row execute function public.set_updated_at();

alter table public.product_reviews enable row level security;

grant all on public.product_reviews to service_role;

create function public.get_product_rating_summary(target_product_ids uuid[])
returns table(product_id uuid, average_rating numeric, rating_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    reviews.product_id,
    round(avg(reviews.rating)::numeric, 1) as average_rating,
    count(*)::integer as rating_count
  from public.product_reviews as reviews
  where reviews.product_id = any(target_product_ids)
  group by reviews.product_id;
$$;

revoke all on function public.get_product_rating_summary(uuid[]) from public;
grant execute on function public.get_product_rating_summary(uuid[]) to anon, authenticated, service_role;
