import { randomUUID } from 'node:crypto';
import { requireRole } from '../../lib/backend/auth.js';
import { requestBody, sendJson, validUuid, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../../lib/backend/supabase.js';

type ProductImageUpload = {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  data: Buffer;
};

type ProductInput = {
  name?: unknown;
  description?: unknown;
  category_id?: unknown;
  price?: unknown;
  stock?: unknown;
  status?: unknown;
  image_url?: unknown;
};

function parseProductImageUpload(body: Record<string, unknown>): ProductImageUpload | null | false {
  if (body.image_base64 === undefined && body.image_content_type === undefined) return null;
  if (typeof body.image_base64 !== 'string'
    || body.image_base64.length > 4_000_000
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.image_base64)) return false;

  const data = Buffer.from(body.image_base64, 'base64');
  if (data.length < 1 || data.length > 3_000_000
    || data.toString('base64').replace(/=+$/, '') !== body.image_base64.replace(/=+$/, '')) return false;

  if (body.image_content_type === 'image/jpeg'
    && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg', data };
  }
  if (body.image_content_type === 'image/png'
    && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: 'image/png', extension: 'png', data };
  }
  if (body.image_content_type === 'image/webp'
    && data.toString('ascii', 0, 4) === 'RIFF'
    && data.toString('ascii', 8, 12) === 'WEBP') {
    return { contentType: 'image/webp', extension: 'webp', data };
  }
  return false;
}

async function uploadProductImage(
  supabase: ReturnType<typeof createAdminClient>,
  sellerId: string,
  image: ProductImageUpload,
): Promise<{ path: string; publicUrl: string } | null> {
  const path = `products/${sellerId}/${randomUUID()}.${image.extension}`;
  const { error } = await supabase.storage.from('kurostore-assets').upload(path, image.data, {
    contentType: image.contentType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    console.error('Unable to upload seller product image:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('kurostore-assets').getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

async function removeUploadedProductImage(
  supabase: ReturnType<typeof createAdminClient>,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from('kurostore-assets').remove([path]);
  if (error) console.error('Unable to clean up unused product image:', error.message);
}

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
  if (input.image_url !== undefined) {
    if (input.image_url === null || input.image_url === '') {
      result.image_url = null;
    } else {
      if (typeof input.image_url !== 'string' || input.image_url.length > 2000) return null;
      try {
        const imageUrl = new URL(input.image_url);
        if (imageUrl.protocol !== 'https:' || !imageUrl.hostname) return null;
        result.image_url = imageUrl.toString();
      } catch {
        return null;
      }
    }
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
      .select('id, category_id, name, description, image_url, price, stock, status, sales_count, created_at')
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

    const imageInput = parseProductImageUpload(body);
    if (imageInput === false) {
      sendJson(response, 400, { error: 'Foto produk harus berupa JPEG, PNG, atau WebP dan maksimal 3 MB setelah kompresi.' });
      return;
    }
    const uploadedImage = imageInput ? await uploadProductImage(supabase, seller.user.id, imageInput) : null;
    if (imageInput && !uploadedImage) {
      sendJson(response, 502, { error: 'Foto produk tidak dapat diunggah. Periksa konfigurasi Supabase Storage.' });
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        ...product,
        ...(uploadedImage ? { image_url: uploadedImage.publicUrl } : {}),
        seller_id: seller.user.id,
      })
      .select('id, category_id, name, description, image_url, price, stock, status, created_at')
      .single();

    if (error || !data) {
      console.error('Unable to create seller product:', error?.message ?? 'No product returned.');
      if (uploadedImage) await removeUploadedProductImage(supabase, uploadedImage.path);
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

  const imageInput = parseProductImageUpload(body);
  if (imageInput === false) {
    sendJson(response, 400, { error: 'Foto produk harus berupa JPEG, PNG, atau WebP dan maksimal 3 MB setelah kompresi.' });
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

  const uploadedImage = imageInput ? await uploadProductImage(supabase, seller.user.id, imageInput) : null;
  if (imageInput && !uploadedImage) {
    sendJson(response, 502, { error: 'Foto produk tidak dapat diunggah. Periksa konfigurasi Supabase Storage.' });
    return;
  }

  const { data, error } = await supabase
    .from('products')
    .update({ ...product, ...(uploadedImage ? { image_url: uploadedImage.publicUrl } : {}) })
    .eq('id', productId)
    .eq('seller_id', seller.user.id)
    .select('id, category_id, name, description, image_url, price, stock, status')
    .maybeSingle();

  if (error) {
    console.error('Unable to update seller product:', error.message);
    if (uploadedImage) await removeUploadedProductImage(supabase, uploadedImage.path);
    sendJson(response, 500, { error: 'Produk tidak dapat diperbarui.' });
    return;
  }
  if (!data) {
    if (uploadedImage) await removeUploadedProductImage(supabase, uploadedImage.path);
    sendJson(response, 404, { error: 'Produk tidak ditemukan.' });
    return;
  }

  sendJson(response, 200, { product: data });
}
