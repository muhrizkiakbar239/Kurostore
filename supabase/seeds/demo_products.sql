begin;

do $$
begin
  if not exists (
    select 1
    from public.seller_profiles
    where store_slug = 'kurostore-demo'
  ) then
    raise exception 'Toko demo kurostore-demo belum ditemukan.';
  end if;

  if (
    select count(*)
    from public.categories
    where slug in (
      'elektronik',
      'tas-dan-aksesori',
      'kesehatan-dan-kecantikan',
      'sepatu-pria',
      'baju-wanita'
    )
      and is_active
  ) <> 5 then
    raise exception 'Satu atau lebih kategori produk demo tidak ditemukan atau tidak aktif.';
  end if;
end;
$$;

insert into public.products (
  id,
  seller_id,
  category_id,
  name,
  description,
  price,
  stock,
  status
)
select
  demo.id,
  seller.user_id,
  category.id,
  demo.name,
  demo.description,
  demo.price,
  demo.stock,
  'active'
from (
  values
    (
      '00000000-0000-4000-8000-000000000001'::uuid,
      'elektronik',
      'Headset Wireless X1',
      'Headset wireless nyaman untuk kerja, belajar, dan gaming.',
      799000::numeric,
      25
    ),
    (
      '00000000-0000-4000-8000-000000000002'::uuid,
      'tas-dan-aksesori',
      'Tas Travel Premium',
      'Tas travel ringan dan stylish untuk harian maupun liburan.',
      450000::numeric,
      18
    ),
    (
      '00000000-0000-4000-8000-000000000003'::uuid,
      'kesehatan-dan-kecantikan',
      'Skin Care Vitamin C',
      'Perawatan wajah untuk kulit cerah dan terasa fresh setiap hari.',
      220000::numeric,
      40
    ),
    (
      '00000000-0000-4000-8000-000000000004'::uuid,
      'sepatu-pria',
      'Sepatu Pria Urban',
      'Sepatu santai dengan desain modern untuk aktivitas harian.',
      620000::numeric,
      15
    ),
    (
      '00000000-0000-4000-8000-000000000005'::uuid,
      'baju-wanita',
      'Baju Wanita Casual',
      'Baju casual nyaman dan cocok dipakai untuk sehari-hari.',
      180000::numeric,
      35
    )
) as demo(id, category_slug, name, description, price, stock)
join public.seller_profiles as seller
  on seller.store_slug = 'kurostore-demo'
join public.categories as category
  on category.slug = demo.category_slug
 and category.is_active
on conflict (id) do update
set
  seller_id = excluded.seller_id,
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  stock = excluded.stock,
  status = excluded.status,
  updated_at = now();

commit;
