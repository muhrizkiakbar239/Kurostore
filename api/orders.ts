import { requireRole } from '../lib/backend/auth.js';
import { sendJson, type VercelRequest, type VercelResponse } from '../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../lib/backend/supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }
  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Database pesanan belum dikonfigurasi.' });
    return;
  }

  const supabase = createAdminClient();
  const account = await requireRole(request, response, supabase, ['buyer', 'seller', 'admin']);
  if (!account) return;

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, midtrans_order_id, status, payment_status, payment_type, subtotal, created_at')
    .eq('buyer_id', account.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (ordersError) {
    console.error('Unable to load buyer orders:', ordersError.message);
    sendJson(response, 500, { error: 'Riwayat pesanan tidak dapat dimuat.' });
    return;
  }
  if (!orders?.length) {
    sendJson(response, 200, { orders: [] });
    return;
  }

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('order_id, product_id, product_name, unit_price, price_is_estimate, quantity')
    .in('order_id', orders.map((order) => order.id))
    .order('created_at', { ascending: true });

  if (itemsError) {
    console.error('Unable to load buyer order items:', itemsError.message);
    sendJson(response, 500, { error: 'Detail pesanan tidak dapat dimuat.' });
    return;
  }

  const productIds = [...new Set((items ?? [])
    .map((item) => item.product_id)
    .filter((productId): productId is string => typeof productId === 'string'))];
  const { data: reviews, error: reviewsError } = productIds.length > 0
    ? await supabase
      .from('product_reviews')
      .select('product_id, rating, comment, created_at, updated_at')
      .eq('user_id', account.user.id)
      .in('product_id', productIds)
    : { data: [], error: null };

  if (reviewsError) {
    console.error('Unable to load buyer product ratings:', reviewsError.message);
    sendJson(response, 500, { error: 'Rating produk tidak dapat dimuat.' });
    return;
  }

  const reviewsByProductId = new Map((reviews ?? []).map((review) => [review.product_id, {
    rating: review.rating,
    comment: review.comment,
    createdAt: review.created_at,
    updatedAt: review.updated_at,
  }]));
  const itemsByOrder = new Map<string, Array<{
    productId: string | null;
    name: string;
    unitPrice: number;
    priceIsEstimate: boolean;
    quantity: number;
    review: { rating: number; comment: string; createdAt: string; updatedAt: string } | null;
  }>>();
  for (const item of items ?? []) {
    const orderItems = itemsByOrder.get(item.order_id) ?? [];
    orderItems.push({
      productId: item.product_id,
      name: item.product_name,
      unitPrice: Number(item.unit_price),
      priceIsEstimate: item.price_is_estimate,
      quantity: item.quantity,
      review: item.product_id ? reviewsByProductId.get(item.product_id) ?? null : null,
    });
    itemsByOrder.set(item.order_id, orderItems);
  }

  sendJson(response, 200, {
    orders: orders.map((order) => ({
      id: order.id,
      orderId: order.midtrans_order_id ?? order.id,
      status: order.status,
      paymentStatus: order.payment_status,
      paymentType: order.payment_type,
      total: Number(order.subtotal),
      createdAt: order.created_at,
      items: itemsByOrder.get(order.id) ?? [],
    })),
  });
}
