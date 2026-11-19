import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole } from './auth.js';
import { requestBody, sendJson, validUuid, type VercelRequest, type VercelResponse } from './http.js';
import { createAdminClient, isSupabaseConfigured } from './supabase.js';

type AccountDataHandler = (
  request: VercelRequest,
  response: VercelResponse,
  supabase: SupabaseClient,
  userId: string,
) => Promise<void>;

type CartProduct = {
  id: string;
  name: string;
  price: number;
  price_is_estimate: boolean;
  stock: number;
  status: string;
};

function cartItem(product: CartProduct, quantity: number) {
  return {
    productId: product.id,
    name: product.name,
    price: Number(product.price),
    priceIsEstimate: product.price_is_estimate,
    stock: product.stock,
    quantity,
    available: product.status === 'active' && product.stock > 0 && quantity <= product.stock,
  };
}

async function handleCart(
  request: VercelRequest,
  response: VercelResponse,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  if (request.method === 'GET') {
    const { data: cartRows, error: cartError } = await supabase
      .from('cart_items')
      .select('product_id, quantity')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (cartError) {
      console.error('Unable to fetch cart:', cartError.message);
      sendJson(response, 500, { error: 'Keranjang tidak dapat dimuat.' });
      return;
    }

    const productIds = (cartRows ?? []).map((item) => item.product_id);
    if (productIds.length === 0) {
      sendJson(response, 200, { items: [] });
      return;
    }

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, price_is_estimate, stock, status')
      .in('id', productIds);

    if (productsError) {
      console.error('Unable to fetch cart products:', productsError.message);
      sendJson(response, 500, { error: 'Produk di keranjang tidak dapat dimuat.' });
      return;
    }

    const productsById = new Map((products ?? []).map((product) => [product.id, product as CartProduct]));
    const items = (cartRows ?? []).flatMap((item) => {
      const product = productsById.get(item.product_id);
      return product ? [cartItem(product, item.quantity)] : [];
    });
    sendJson(response, 200, { items });
    return;
  }

  const body = requestBody(request);
  if (!body) {
    sendJson(response, 400, { error: 'Produk keranjang tidak valid.' });
    return;
  }

  if (request.method === 'DELETE') {
    const productIds = Array.isArray(body.product_ids) ? body.product_ids : [body.product_id];
    if (productIds.length < 1 || productIds.length > 200 || !productIds.every(validUuid)) {
      sendJson(response, 400, { error: 'Daftar produk keranjang tidak valid.' });
      return;
    }

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId)
      .in('product_id', productIds);

    if (error) {
      console.error('Unable to remove cart items:', error.message);
      sendJson(response, 500, { error: 'Produk tidak dapat dihapus dari keranjang.' });
      return;
    }

    sendJson(response, 200, { removed: productIds.length });
    return;
  }

  if (!validUuid(body.product_id)) {
    sendJson(response, 400, { error: 'Produk keranjang tidak valid.' });
    return;
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, price, price_is_estimate, stock, status')
    .eq('id', body.product_id)
    .maybeSingle();

  if (productError) {
    console.error('Unable to validate cart product:', productError.message);
    sendJson(response, 500, { error: 'Produk keranjang tidak dapat diverifikasi.' });
    return;
  }
  if (!product || product.status !== 'active') {
    sendJson(response, 404, { error: 'Produk tidak tersedia.' });
    return;
  }

  let quantity: number;
  if (request.method === 'POST') {
    const { data: existingItem, error: existingError } = await supabase
      .from('cart_items')
      .select('quantity')
      .eq('user_id', userId)
      .eq('product_id', product.id)
      .maybeSingle();

    if (existingError) {
      console.error('Unable to read existing cart item:', existingError.message);
      sendJson(response, 500, { error: 'Keranjang tidak dapat diperbarui.' });
      return;
    }

    quantity = (existingItem?.quantity ?? 0) + 1;
  } else {
    if (typeof body.quantity !== 'number'
      || !Number.isInteger(body.quantity)
      || body.quantity < 1
      || body.quantity > 999) {
      sendJson(response, 400, { error: 'Jumlah produk keranjang tidak valid.' });
      return;
    }
    quantity = body.quantity;
  }

  if (product.stock < 1 || quantity > product.stock || quantity > 999) {
    sendJson(response, 409, { error: 'Jumlah produk melebihi stok yang tersedia.' });
    return;
  }

  const { data: savedItem, error: saveError } = await supabase
    .from('cart_items')
    .upsert(
      { user_id: userId, product_id: product.id, quantity },
      { onConflict: 'user_id,product_id' },
    )
    .select('quantity')
    .single();

  if (saveError || !savedItem) {
    console.error('Unable to save cart item:', saveError?.message ?? 'No cart item returned.');
    sendJson(response, 500, { error: 'Perubahan keranjang tidak dapat disimpan.' });
    return;
  }

  sendJson(response, 200, { item: cartItem(product as CartProduct, savedItem.quantity) });
}

async function handleWishlist(
  request: VercelRequest,
  response: VercelResponse,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  if (request.method === 'GET') {
    const { data: wishlistRows, error: wishlistError } = await supabase
      .from('wishlist_items')
      .select('product_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (wishlistError) {
      console.error('Unable to fetch wishlist:', wishlistError.message);
      sendJson(response, 500, { error: 'Wishlist tidak dapat dimuat.' });
      return;
    }

    const productIds = (wishlistRows ?? []).map((item) => item.product_id);
    if (productIds.length === 0) {
      sendJson(response, 200, { items: [] });
      return;
    }

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, description, price, price_is_estimate, stock, category_id, status')
      .in('id', productIds);

    if (productsError) {
      console.error('Unable to fetch wishlist products:', productsError.message);
      sendJson(response, 500, { error: 'Produk wishlist tidak dapat dimuat.' });
      return;
    }

    const productsById = new Map((products ?? []).map((product) => [product.id, product]));
    const items = productIds.flatMap((productId) => {
      const product = productsById.get(productId);
      return product ? [product] : [];
    });
    sendJson(response, 200, { items });
    return;
  }

  const body = requestBody(request);
  if (!body || !validUuid(body.product_id)) {
    sendJson(response, 400, { error: 'Produk wishlist tidak valid.' });
    return;
  }

  if (request.method === 'DELETE') {
    const { error } = await supabase
      .from('wishlist_items')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', body.product_id);

    if (error) {
      console.error('Unable to remove wishlist item:', error.message);
      sendJson(response, 500, { error: 'Produk tidak dapat dihapus dari wishlist.' });
      return;
    }

    sendJson(response, 200, { product_id: body.product_id, removed: true });
    return;
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('id', body.product_id)
    .eq('status', 'active')
    .maybeSingle();

  if (productError) {
    console.error('Unable to validate wishlist product:', productError.message);
    sendJson(response, 500, { error: 'Produk wishlist tidak dapat diverifikasi.' });
    return;
  }
  if (!product) {
    sendJson(response, 404, { error: 'Produk tidak tersedia.' });
    return;
  }

  const { error } = await supabase
    .from('wishlist_items')
    .upsert(
      { user_id: userId, product_id: body.product_id },
      { onConflict: 'user_id,product_id', ignoreDuplicates: true },
    );

  if (error) {
    console.error('Unable to save wishlist item:', error.message);
    sendJson(response, 500, { error: 'Produk tidak dapat disimpan ke wishlist.' });
    return;
  }

  sendJson(response, 200, { product_id: body.product_id, saved: true });
}

async function handleAddress(
  request: VercelRequest,
  response: VercelResponse,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  if (request.method === 'GET') {
    const { data, error } = await supabase
      .from('account_addresses')
      .select('name, phone, address, city, postal_code')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Unable to fetch saved shipping address:', error.message);
      sendJson(response, 500, { error: 'Alamat tersimpan tidak dapat dimuat.' });
      return;
    }

    sendJson(response, 200, { address: data ? { ...data, postalCode: data.postal_code } : null });
    return;
  }

  const body = requestBody(request);
  const address = {
    name: typeof body?.name === 'string' ? body.name.trim() : '',
    phone: typeof body?.phone === 'string' ? body.phone.trim() : '',
    address: typeof body?.address === 'string' ? body.address.trim() : '',
    city: typeof body?.city === 'string' ? body.city.trim() : '',
    postal_code: typeof body?.postal_code === 'string' ? body.postal_code.trim() : '',
  };

  if (address.name.length < 1 || address.name.length > 100
    || address.phone.length < 1 || address.phone.length > 30
    || address.address.length < 1 || address.address.length > 300
    || address.city.length < 1 || address.city.length > 100
    || address.postal_code.length < 1 || address.postal_code.length > 10) {
    sendJson(response, 400, { error: 'Lengkapi alamat dengan format yang valid.' });
    return;
  }

  const { data, error } = await supabase
    .from('account_addresses')
    .upsert({ user_id: userId, ...address }, { onConflict: 'user_id' })
    .select('name, phone, address, city, postal_code')
    .single();

  if (error || !data) {
    console.error('Unable to save shipping address:', error?.message ?? 'No address returned.');
    sendJson(response, 500, { error: 'Alamat tidak dapat disimpan.' });
    return;
  }

  sendJson(response, 200, { address: { ...data, postalCode: data.postal_code } });
}

async function handleCompleteOrder(
  request: VercelRequest,
  response: VercelResponse,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const body = requestBody(request);
  if (!validUuid(body?.order_id)) {
    sendJson(response, 400, { error: 'ID pesanan tidak valid.' });
    return;
  }

  const { data: completedOrder, error } = await supabase
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', body.order_id)
    .eq('buyer_id', userId)
    .eq('payment_status', 'paid')
    .in('status', ['paid', 'processing', 'shipped'])
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Unable to complete received order:', error.message);
    sendJson(response, 500, { error: 'Status pesanan tidak dapat diperbarui.' });
    return;
  }
  if (completedOrder) {
    sendJson(response, 200, { order_id: completedOrder.id, status: 'completed' });
    return;
  }

  const { data: existingOrder, error: existingError } = await supabase
    .from('orders')
    .select('id, status, payment_status')
    .eq('id', body.order_id)
    .eq('buyer_id', userId)
    .maybeSingle();

  if (existingError) {
    console.error('Unable to verify completed order:', existingError.message);
    sendJson(response, 500, { error: 'Pesanan tidak dapat diverifikasi.' });
    return;
  }
  if (existingOrder?.status === 'completed' && existingOrder.payment_status === 'paid') {
    sendJson(response, 200, { order_id: existingOrder.id, status: 'completed' });
    return;
  }

  sendJson(response, 409, { error: 'Hanya pesanan yang sudah dibayar dan diterima yang dapat diselesaikan.' });
}

async function handleRating(
  request: VercelRequest,
  response: VercelResponse,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const body = requestBody(request);
  const rating = body?.rating;
  if (body && Object.hasOwn(body, 'comment') && typeof body.comment !== 'string') {
    sendJson(response, 400, { error: 'Ulasan harus berupa teks.' });
    return;
  }
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';
  if (!validUuid(body?.product_id) || !validUuid(body?.order_id)
    || typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5
    || comment.length > 1000) {
    sendJson(response, 400, { error: 'Data rating tidak valid.' });
    return;
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', body.order_id)
    .eq('buyer_id', userId)
    .eq('status', 'completed')
    .eq('payment_status', 'paid')
    .maybeSingle();

  if (orderError) {
    console.error('Unable to verify order for product rating:', orderError.message);
    sendJson(response, 500, { error: 'Pesanan tidak dapat diverifikasi.' });
    return;
  }
  if (!order) {
    sendJson(response, 403, { error: 'Rating hanya tersedia untuk pesanan yang sudah dibayar dan diselesaikan.' });
    return;
  }

  const { data: orderItem, error: itemError } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', order.id)
    .eq('product_id', body.product_id)
    .maybeSingle();

  if (itemError) {
    console.error('Unable to verify rated product in order:', itemError.message);
    sendJson(response, 500, { error: 'Produk pada pesanan tidak dapat diverifikasi.' });
    return;
  }
  if (!orderItem) {
    sendJson(response, 403, { error: 'Produk ini tidak ditemukan di pesanan yang telah diselesaikan.' });
    return;
  }

  const { data: savedReview, error: reviewError } = await supabase
    .from('product_reviews')
    .upsert({
      product_id: body.product_id,
      user_id: userId,
      order_id: order.id,
      rating,
      comment,
    }, { onConflict: 'user_id,product_id' })
    .select('product_id, rating, comment, created_at, updated_at')
    .single();

  if (reviewError || !savedReview) {
    console.error('Unable to save product rating:', reviewError?.message ?? 'No rating returned.');
    sendJson(response, 500, { error: 'Rating produk tidak dapat disimpan.' });
    return;
  }

  sendJson(response, 200, { review: savedReview });
}

const routeHandlers: Record<string, { methods: string[]; handle: AccountDataHandler }> = {
  cart: { methods: ['GET', 'POST', 'PATCH', 'DELETE'], handle: handleCart },
  wishlist: { methods: ['GET', 'POST', 'DELETE'], handle: handleWishlist },
  address: { methods: ['GET', 'PUT'], handle: handleAddress },
  'complete-order': { methods: ['POST'], handle: handleCompleteOrder },
  ratings: { methods: ['POST'], handle: handleRating },
};

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname
    .replace(/\/+$/, '')
    .split('/')
    .pop();
  const route = path ? routeHandlers[path] : undefined;

  if (!route) {
    sendJson(response, 404, { error: 'Endpoint tidak ditemukan.' });
    return;
  }

  if (!route.methods.includes(request.method ?? '')) {
    response.setHeader('Allow', route.methods.join(', '));
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  response.setHeader('Cache-Control', 'no-store');
  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Backend Supabase belum dikonfigurasi.' });
    return;
  }

  const supabase = createAdminClient();
  const account = await requireRole(request, response, supabase, ['buyer', 'seller', 'admin']);
  if (!account) return;

  await route.handle(request, response, supabase, account.user.id);
}
