alter table public.orders
  add column midtrans_order_id text unique,
  add column payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partial_refunded', 'disputed')),
  add column midtrans_transaction_status text,
  add column payment_type text,
  add column payment_updated_at timestamptz;
