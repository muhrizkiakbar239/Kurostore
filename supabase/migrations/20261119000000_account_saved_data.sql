create table public.account_addresses (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (char_length(phone) between 1 and 30),
  address text not null check (char_length(address) between 1 and 300),
  city text not null check (char_length(city) between 1 and 100),
  postal_code text not null check (char_length(postal_code) between 1 and 10),
  updated_at timestamptz not null default now()
);

create trigger account_addresses_set_updated_at before update on public.account_addresses
  for each row execute function public.set_updated_at();

alter table public.account_addresses enable row level security;

create policy "Users manage their own shipping address"
  on public.account_addresses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.account_addresses to authenticated;
