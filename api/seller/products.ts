import { requireRole } from '../../lib/backend/auth.js';
import { requestBody, sendJson, validUuid, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../../lib/backend/supabase.js';

type ProductInput = {
  name?: unknown;
  description?: unknown;
  category_id?: unknown;
  price?: unknown;
  stock?: unknown;
  status?: unknown;
};

function validateProductInput(input: ProductInput, partial: boolean): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};

  if (!partial || input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 160) return null;
    result.name = input.name.trim();
  }
  if (!partial || input.description !== undefined) {
    if (input.description !== undefined
      && (typeof input.description !== 'string' || input.description.length > 5000)) return null;
    result.description = typeof input.description === 'string' ? input.description.trim() : '';
  }
  if (input.category_id !== undefined) {
    if (input.category_id !== null && !validUuid(input.category_id)) return null;
    result.category_id = input.category_id;
  }
  if (!partial || input.price !== undefined) {
    if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price <= 0) return null;
    result.price = input.price;
  }
  if (!partial || input.stock !== undefined) {
    if (typeof input.stock !== 'number' || !Number.isInteger(input.stock) || input.stock < 0) return null;
    result.stock = input.stock;
  }
  if (input.status !== undefined) {
    if (!['draft', 'active', 'archived'].includes(String(input.status))) return null;
    result.status = input.status;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method ?? '')) {
    response.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Backend Supabase belum dikonfigurasi.' });
    return;
  }

  const supabase = createAdminClient();
  const seller = await requireRole(request, response, supabase, ['seller']);
  if (!seller) return;

  if (request.method === 'GET') {
    const { data, error } = await supabase
      .from('products')
      .select('id, category_id, name, description, price, stock, status, sales_count, created_at')
      .eq('seller_id', seller.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Unable to fetch seller products:', error.message);
      sendJson(response, 500, { error: 'Produk toko tidak dapat dimuat.' });
      return;
    }

    sendJson(response, 200, { products: data });
    return;
  }

  const body = requestBody(request);
  if (!body) {
    sendJson(response, 400, { error: 'Isi permintaan tidak valid.' });
    return;
  }

  if (request.method === 'POST') {
    const product = validateProductInput(body, false);
    if (!product) {
      sendJson(response, 400, { error: 'Data produk tidak valid.' });
      return;
    }

    if (product.category_id) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', product.category_id)
        .eq('is_active', true)
        .maybeSingle();
      if (categoryError) {
        console.error('Unable to validate product category:', categoryError.message);
        sendJson(response, 500, { error: 'Kategori produk tidak dapat diverifikasi.' });
        return;
      }
      if (!category) {
        sendJson(response, 400, { error: 'Kategori produk tidak tersedia.' });
        return;
      }
    }

    const { data, error } = await supabase
      .from('products')
      .insert({ ...product, seller_id: seller.user.id })
      .select('id, category_id, name, description, price, stock, status, created_at')
      .single();

    if (error || !data) {
      console.error('Unable to create seller product:', error?.message ?? 'No product returned.');
      sendJson(response, 500, { error: 'Produk tidak dapat disimpan.' });
      return;
    }
    sendJson(response, 201, { product: data });
    return;
  }

  const productId = body.product_id;
  if (!validUuid(productId)) {
    sendJson(response, 400, { error: 'ID produk tidak valid.' });
    return;
  }

  if (request.method === 'DELETE') {
    const { data, error } = await supabase
      .from('products')
      .update({ status: 'archived' })
      .eq('id', productId)
      .eq('seller_id', seller.user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Unable to archive seller product:', error.message);
      sendJson(response, 500, { error: 'Produk tidak dapat diarsipkan.' });
      return;
    }
    if (!data) {
      sendJson(response, 404, { error: 'Produk tidak ditemukan.' });
      return;
    }
    sendJson(response, 200, { product_id: data.id, status: 'archived' });
    return;
  }

  const product = validateProductInput(body, true);
  if (!product) {
    sendJson(response, 400, { error: 'Data perubahan produk tidak valid.' });
    return;
  }

  if (product.category_id) {
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', product.category_id)
      .eq('is_active', true)
      .maybeSingle();
    if (categoryError) {
      console.error('Unable to validate product category:', categoryError.message);
      sendJson(response, 500, { error: 'Kategori produk tidak dapat diverifikasi.' });
      return;
    }
    if (!category) {
      sendJson(response, 400, { error: 'Kategori produk tidak tersedia.' });
      return;
    }
  }

  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', productId)
    .eq('seller_id', seller.user.id)
    .select('id, category_id, name, description, price, stock, status')
    .maybeSingle();

  if (error) {
    console.error('Unable to update seller product:', error.message);
    sendJson(response, 500, { error: 'Produk tidak dapat diperbarui.' });
    return;
  }
  if (!data) {
    sendJson(response, 404, { error: 'Produk tidak ditemukan.' });
    return;
  }

  sendJson(response, 200, { product: data });
}
