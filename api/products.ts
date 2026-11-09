import { queryString, sendJson, validUuid, type VercelRequest, type VercelResponse } from '../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../lib/backend/supabase.js';

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
  if (categoryId && !validUuid(categoryId)) {
    sendJson(response, 400, { error: 'Kategori tidak valid.' });
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
    .select('id, seller_id, category_id, name, description, price, stock, sales_count, created_at', { count: 'exact' })
    .eq('status', 'active')
    .range(offset, offset + pageSize - 1);

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

  sendJson(response, 200, {
    products: data,
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
  });
}
