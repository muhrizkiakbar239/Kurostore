import { queryString, sendJson, validUuid, type VercelRequest, type VercelResponse } from '../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../lib/backend/supabase.js';

type ProductRatingSummary = {
  product_id: string;
  average_rating: number | string;
  rating_count: number | string;
};

function isProductRatingSummary(value: unknown): value is ProductRatingSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Record<string, unknown>;
  return typeof summary.product_id === 'string'
    && (typeof summary.average_rating === 'number' || typeof summary.average_rating === 'string')
    && (typeof summary.rating_count === 'number' || typeof summary.rating_count === 'string');
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Backend Supabase belum dikonfigurasi.' });
    return;
  }

  const categoryId = queryString(request.query.category_id);
  const productId = queryString(request.query.product_id);
  if (categoryId && !validUuid(categoryId)) {
    sendJson(response, 400, { error: 'Kategori tidak valid.' });
    return;
  }
  if (productId && !validUuid(productId)) {
    sendJson(response, 400, { error: 'ID produk tidak valid.' });
    return;
  }

  const search = queryString(request.query.q);
  if (search && search.length > 100) {
    sendJson(response, 400, { error: 'Kata pencarian maksimal 100 karakter.' });
    return;
  }

  const sort = queryString(request.query.sort) ?? 'newest';
  if (!['newest', 'popular', 'price_low', 'price_high'].includes(sort)) {
    sendJson(response, 400, { error: 'Urutan produk tidak valid.' });
    return;
  }

  const pageValue = queryString(request.query.page) ?? '1';
  const pageSizeValue = queryString(request.query.page_size) ?? '50';
  if (!/^\d+$/.test(pageValue) || !/^\d+$/.test(pageSizeValue)) {
    sendJson(response, 400, { error: 'Halaman atau jumlah produk tidak valid.' });
    return;
  }

  const page = Number(pageValue);
  const pageSize = Number(pageSizeValue);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000
    || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    sendJson(response, 400, { error: 'Halaman atau jumlah produk tidak valid.' });
    return;
  }

  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) {
    sendJson(response, 400, { error: 'Halaman produk terlalu besar.' });
    return;
  }

  const supabase = createAdminClient();
  let query = supabase
    .from('products')
    .select('id, seller_id, category_id, name, description, image_url, price, price_is_estimate, stock, sales_count, created_at', { count: 'exact' })
    .eq('status', 'active')
    .range(offset, offset + pageSize - 1);

  if (productId) query = query.eq('id', productId);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (search) query = query.ilike('name', `%${search.replace(/[%_]/g, '\\$&')}%`);

  if (sort === 'popular') query = query.order('sales_count', { ascending: false });
  else if (sort === 'price_low') query = query.order('price', { ascending: true });
  else if (sort === 'price_high') query = query.order('price', { ascending: false });
  else query = query.order('created_at', { ascending: false });
  query = query.order('id', { ascending: true });

  const { data, error, count } = await query;
  if (error) {
    console.error('Unable to fetch public products:', error.message);
    sendJson(response, 500, { error: 'Produk tidak dapat dimuat saat ini.' });
    return;
  }

  const productIds = (data ?? []).map((product) => product.id);
  const { data: ratingSummaries, error: ratingsError } = productIds.length > 0
    ? await supabase.rpc('get_product_rating_summary', { target_product_ids: productIds })
    : { data: [], error: null };
  if (ratingsError) {
    console.error('Unable to fetch product rating summaries:', ratingsError.message);
    sendJson(response, 500, { error: 'Rating produk tidak dapat dimuat saat ini.' });
    return;
  }

  const ratingsByProductId = new Map<string, { average: number; count: number }>();
  const ratingRows: unknown = ratingSummaries ?? [];
  if (!Array.isArray(ratingRows) || !ratingRows.every(isProductRatingSummary)) {
    console.error('Unable to parse product rating summaries.');
    sendJson(response, 500, { error: 'Rating produk tidak dapat dimuat saat ini.' });
    return;
  }
  for (const summary of ratingRows) {
    const average = Number(summary.average_rating);
    const count = Number(summary.rating_count);
    if (!Number.isFinite(average) || !Number.isSafeInteger(count) || count < 0) {
      console.error('Invalid product rating summary returned from database.');
      sendJson(response, 500, { error: 'Rating produk tidak dapat dimuat saat ini.' });
      return;
    }
    ratingsByProductId.set(summary.product_id, { average, count });
  }

  const products = (data ?? []).map((product) => ({
    ...product,
    rating_average: ratingsByProductId.get(product.id)?.average ?? 0,
    rating_count: ratingsByProductId.get(product.id)?.count ?? 0,
  }));
  response.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

  if (productId) {
    const product = products[0];
    if (!product) {
      sendJson(response, 404, { error: 'Produk tidak ditemukan.' });
      return;
    }

    const [
      { data: seller, error: sellerError },
      { data: category, error: categoryError },
      { data: reviews, error: reviewsError },
    ] = await Promise.all([
      supabase.from('seller_profiles').select('store_name').eq('user_id', product.seller_id).maybeSingle(),
      product.category_id
        ? supabase.from('categories').select('name').eq('id', product.category_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from('product_reviews')
        .select('rating, comment, created_at')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    if (sellerError || categoryError || reviewsError) {
      console.error('Unable to fetch product details:', sellerError?.message ?? categoryError?.message ?? reviewsError?.message);
      sendJson(response, 500, { error: 'Detail produk tidak dapat dimuat saat ini.' });
      return;
    }

    sendJson(response, 200, {
      product: {
        ...product,
        seller_name: seller?.store_name ?? 'Seller Kurostore',
        category_name: category?.name ?? 'Semua kategori',
      },
      reviews: reviews ?? [],
    });
    return;
  }

  sendJson(response, 200, {
    products,
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
  });
}
