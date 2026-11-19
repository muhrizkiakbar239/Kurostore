delete from public.products as product
using public.seller_profiles as seller, public.categories as category
where product.seller_id = seller.user_id
  and product.category_id = category.id
  and seller.store_slug = 'kurostore-demo'
  and category.slug = 'voucher-dan-produk-digital'
  and product.name like 'Voucher Digital Demo Rp%';
