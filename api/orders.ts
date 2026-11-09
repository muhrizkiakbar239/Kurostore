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
    .select('order_id, product_name, unit_price, quantity')
    .in('order_id', orders.map((order) => order.id))
    .order('created_at', { ascending: true });

  if (itemsError) {
    console.error('Unable to load buyer order items:', itemsError.message);
    sendJson(response, 500, { error: 'Detail pesanan tidak dapat dimuat.' });
    return;
  }

  const itemsByOrder = new Map<string, Array<{
    name: string;
    unitPrice: number;
    quantity: number;
  }>>();
  for (const item of items ?? []) {
    const orderItems = itemsByOrder.get(item.order_id) ?? [];
    orderItems.push({
      name: item.product_name,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
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
