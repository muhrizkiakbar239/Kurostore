alter table public.profiles
  add column phone text not null default '' check (char_length(phone) <= 30);

alter table public.orders
  add column points_redeemed integer not null default 0 check (points_redeemed >= 0),
  add column points_discount numeric(12, 2) not null default 0 check (points_discount >= 0);

create table public.account_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  preferred_payment_method text not null default 'all'
    check (preferred_payment_method in ('all', 'qris', 'ewallet', 'bank_transfer', 'credit_card', 'kuropay_demo')),
  email_order_updates boolean not null default false,
  language text not null default 'id' check (language in ('id', 'en', 'ja')),
  theme text not null default 'light' check (theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger account_preferences_set_updated_at before update on public.account_preferences
  for each row execute function public.set_updated_at();

create table public.kuropay_demo_wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.kuropay_demo_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_type text not null check (entry_type in ('credit', 'debit')),
  amount bigint not null check (amount > 0),
  source_type text not null check (source_type in ('topup', 'purchase')),
  source_id text not null,
  description text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create index kuropay_demo_ledger_user_created
  on public.kuropay_demo_ledger (user_id, created_at desc);

create table public.kuropay_demo_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  midtrans_order_id text not null unique,
  amount bigint not null check (amount between 5000 and 1000000),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  payment_type text,
  transaction_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kuropay_demo_topups_user_created
  on public.kuropay_demo_topups (user_id, created_at desc);

create trigger kuropay_demo_topups_set_updated_at before update on public.kuropay_demo_topups
  for each row execute function public.set_updated_at();

create table public.account_reward_points (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.account_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  points_delta integer not null check (points_delta <> 0),
  source_type text not null check (source_type in ('order_reward', 'order_redeem', 'order_reversal')),
  source_id text not null,
  description text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create index account_reward_ledger_user_created
  on public.account_reward_ledger (user_id, created_at desc);

create or replace function public.apply_kuropay_demo_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entry_type = 'credit' then
    insert into public.kuropay_demo_wallets (user_id, balance)
    values (new.user_id, new.amount)
    on conflict (user_id) do update
      set balance = public.kuropay_demo_wallets.balance + excluded.balance,
          updated_at = now();
  else
    update public.kuropay_demo_wallets
    set balance = balance - new.amount,
        updated_at = now()
    where user_id = new.user_id and balance >= new.amount;
    if not found then
      raise exception 'INSUFFICIENT_DEMO_BALANCE';
    end if;
  end if;
  return new;
end;
$$;

create trigger kuropay_demo_ledger_apply
  after insert on public.kuropay_demo_ledger
  for each row execute function public.apply_kuropay_demo_ledger();

create or replace function public.apply_account_reward_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.points_delta > 0 then
    insert into public.account_reward_points (user_id, balance)
    values (new.user_id, new.points_delta)
    on conflict (user_id) do update
      set balance = public.account_reward_points.balance + excluded.balance,
          updated_at = now();
  else
    update public.account_reward_points
    set balance = balance + new.points_delta,
        updated_at = now()
    where user_id = new.user_id and balance >= -new.points_delta;
    if not found then
      raise exception 'INSUFFICIENT_REWARD_POINTS';
    end if;
  end if;
  return new;
end;
$$;

create trigger account_reward_ledger_apply
  after insert on public.account_reward_ledger
  for each row execute function public.apply_account_reward_ledger();

create or replace function public.complete_kuropay_demo_topup(
  target_order_id text,
  target_status text,
  target_payment_type text,
  target_transaction_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  topup_record public.kuropay_demo_topups%rowtype;
begin
  select * into topup_record
  from public.kuropay_demo_topups
  where midtrans_order_id = target_order_id
  for update;

  if not found then
    return 'missing';
  end if;

  if topup_record.status <> 'pending' then
    return 'unchanged';
  end if;

  if target_status = 'paid' then
    update public.kuropay_demo_topups
    set status = 'paid',
        payment_type = target_payment_type,
        transaction_status = target_transaction_status
    where id = topup_record.id;

    insert into public.kuropay_demo_ledger
      (user_id, entry_type, amount, source_type, source_id, description)
    values
      (topup_record.user_id, 'credit', topup_record.amount, 'topup', topup_record.id::text, 'Top up saldo demo KuroPay')
    on conflict (user_id, source_type, source_id) do nothing;
    return 'updated';
  end if;

  if target_status = 'failed' then
    update public.kuropay_demo_topups
    set status = 'failed',
        payment_type = target_payment_type,
        transaction_status = target_transaction_status
    where id = topup_record.id;
    return 'updated';
  end if;

  return 'unchanged';
end;
$$;

create or replace function public.reserve_demo_order_points(target_order_id uuid, target_points integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
begin
  if target_points < 0 or target_points % 100 <> 0 then
    raise exception 'INVALID_REWARD_REDEMPTION';
  end if;

  select * into order_record
  from public.orders
  where id = target_order_id
  for update;

  if not found or order_record.payment_status <> 'pending' then
    raise exception 'ORDER_NOT_PENDING';
  end if;

  if target_points = 0 then
    return true;
  end if;

  if target_points > order_record.points_redeemed
    or (target_points::numeric / 100 * 1000) <> order_record.points_discount then
    raise exception 'INVALID_REWARD_REDEMPTION';
  end if;

  insert into public.account_reward_points (user_id, balance)
  values (order_record.buyer_id, 0)
  on conflict (user_id) do nothing;

  insert into public.account_reward_ledger
    (user_id, points_delta, source_type, source_id, description)
  values
    (order_record.buyer_id, -target_points, 'order_redeem', order_record.id::text, 'Penukaran poin pada pesanan')
  on conflict (user_id, source_type, source_id) do nothing;

  return true;
end;
$$;

create or replace function public.release_demo_order_points(target_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
begin
  select * into order_record
  from public.orders
  where id = target_order_id
  for update;

  if not found or order_record.points_redeemed = 0 then
    return true;
  end if;

  insert into public.account_reward_ledger
    (user_id, points_delta, source_type, source_id, description)
  values
    (order_record.buyer_id, order_record.points_redeemed, 'order_reversal', order_record.id::text, 'Pengembalian poin dari pesanan gagal')
  on conflict (user_id, source_type, source_id) do nothing;

  return true;
end;
$$;

create or replace function public.award_demo_order_points(target_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
begin
  select * into order_record
  from public.orders
  where id = target_order_id
  for update;

  if not found
    or order_record.payment_status <> 'paid'
    or order_record.subtotal - order_record.points_discount < 5000 then
    return false;
  end if;

  insert into public.account_reward_ledger
    (user_id, points_delta, source_type, source_id, description)
  values
    (order_record.buyer_id, 100, 'order_reward', order_record.id::text, 'Poin demo dari pesanan sandbox')
  on conflict (user_id, source_type, source_id) do nothing;

  return true;
end;
$$;

create or replace function public.pay_demo_wallet_order(target_user_id uuid, target_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
  payable_amount numeric(12, 2);
begin
  select * into order_record
  from public.orders
  where id = target_order_id and buyer_id = target_user_id
  for update;

  if not found or order_record.payment_status <> 'pending' then
    raise exception 'ORDER_NOT_PENDING';
  end if;

  payable_amount := order_record.subtotal - order_record.points_discount;

  if order_record.points_redeemed > 0 then
    insert into public.account_reward_points (user_id, balance)
    values (target_user_id, 0)
    on conflict (user_id) do nothing;

    insert into public.account_reward_ledger
      (user_id, points_delta, source_type, source_id, description)
    values
      (target_user_id, -order_record.points_redeemed, 'order_redeem', order_record.id::text, 'Penukaran poin pada pesanan')
    on conflict (user_id, source_type, source_id) do nothing;
  end if;

  if payable_amount > 0 then
    insert into public.kuropay_demo_ledger
      (user_id, entry_type, amount, source_type, source_id, description)
    values
      (target_user_id, 'debit', payable_amount::bigint, 'purchase', order_record.id::text, 'Pembayaran demo KuroPay');
  end if;

  update public.orders
  set status = 'paid',
      payment_status = 'paid',
      payment_type = case when payable_amount = 0 then 'reward_points_demo' else 'kuropay_demo' end,
      midtrans_transaction_status = 'sandbox_wallet',
      payment_updated_at = now()
  where id = order_record.id;

  perform public.award_demo_order_points(order_record.id);
  return true;
end;
$$;

alter table public.account_preferences enable row level security;
alter table public.kuropay_demo_wallets enable row level security;
alter table public.kuropay_demo_ledger enable row level security;
alter table public.kuropay_demo_topups enable row level security;
alter table public.account_reward_points enable row level security;
alter table public.account_reward_ledger enable row level security;

create policy "Users can read their own account preferences"
  on public.account_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can read their own KuroPay demo balance"
  on public.kuropay_demo_wallets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can read their own KuroPay demo ledger"
  on public.kuropay_demo_ledger for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can read their own KuroPay demo top ups"
  on public.kuropay_demo_topups for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can read their own reward points"
  on public.account_reward_points for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can read their own reward ledger"
  on public.account_reward_ledger for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.account_preferences to authenticated;
grant select on public.kuropay_demo_wallets to authenticated;
grant select on public.kuropay_demo_ledger to authenticated;
grant select on public.kuropay_demo_topups to authenticated;
grant select on public.account_reward_points to authenticated;
grant select on public.account_reward_ledger to authenticated;

revoke all on function public.complete_kuropay_demo_topup(text, text, text, text) from public, anon, authenticated;
revoke all on function public.reserve_demo_order_points(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_demo_order_points(uuid) from public, anon, authenticated;
revoke all on function public.award_demo_order_points(uuid) from public, anon, authenticated;
revoke all on function public.pay_demo_wallet_order(uuid, uuid) from public, anon, authenticated;

grant execute on function public.complete_kuropay_demo_topup(text, text, text, text) to service_role;
grant execute on function public.reserve_demo_order_points(uuid, integer) to service_role;
grant execute on function public.release_demo_order_points(uuid) to service_role;
grant execute on function public.award_demo_order_points(uuid) to service_role;
grant execute on function public.pay_demo_wallet_order(uuid, uuid) to service_role;
