import '../../lib/backend/load-local-env.js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { requestBody, sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../../lib/backend/supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
  if (!serverKey) {
    sendJson(response, 503, { error: 'Midtrans belum dikonfigurasi.' });
    return;
  }
  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Database pesanan belum dikonfigurasi.' });
    return;
  }

  const body = requestBody(request);
  const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
  const statusCode = body?.status_code === undefined ? '' : String(body.status_code);
  const grossAmount = typeof body?.gross_amount === 'string' ? body.gross_amount : '';
  const signatureKey = typeof body?.signature_key === 'string' ? body.signature_key : '';
  const transactionStatus = typeof body?.transaction_status === 'string' ? body.transaction_status : '';
  const fraudStatus = typeof body?.fraud_status === 'string' ? body.fraud_status : '';
  const paymentType = typeof body?.payment_type === 'string' ? body.payment_type : null;

  if (!orderId || !statusCode || !grossAmount || !/^[a-f0-9]{128}$/i.test(signatureKey)) {
    sendJson(response, 400, { error: 'Notifikasi pembayaran tidak valid.' });
    return;
  }

  const expectedSignature = createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest();
  const receivedSignature = Buffer.from(signatureKey, 'hex');
  if (receivedSignature.length !== expectedSignature.length
    || !timingSafeEqual(receivedSignature, expectedSignature)) {
    sendJson(response, 401, { error: 'Signature notifikasi pembayaran tidak valid.' });
    return;
  }

  let paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refunded' | 'disputed';
  let orderStatus: 'pending' | 'paid' | 'cancelled' | null;
  if (transactionStatus === 'settlement'
    || (transactionStatus === 'capture' && fraudStatus === 'accept')) {
    paymentStatus = 'paid';
    orderStatus = 'paid';
  } else if (transactionStatus === 'pending'
    || (transactionStatus === 'capture' && fraudStatus === 'challenge')) {
    paymentStatus = 'pending';
    orderStatus = 'pending';
  } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
    paymentStatus = 'failed';
    orderStatus = 'cancelled';
  } else if (transactionStatus === 'refund' || transactionStatus === 'partial_refund') {
    paymentStatus = transactionStatus === 'partial_refund' ? 'partial_refunded' : 'refunded';
    orderStatus = null;
  } else if (transactionStatus === 'chargeback' || transactionStatus === 'partial_chargeback') {
    paymentStatus = 'disputed';
    orderStatus = null;
  } else if (transactionStatus === 'authorize') {
    paymentStatus = 'pending';
    orderStatus = 'pending';
  } else if (transactionStatus === 'failure') {
    paymentStatus = 'failed';
    orderStatus = 'cancelled';
  } else {
    sendJson(response, 400, { error: 'Status pembayaran tidak didukung.' });
    return;
  }

  if (paymentStatus === 'refunded' || paymentStatus === 'partial_refunded' || paymentStatus === 'disputed') {
    orderStatus = null;
  }

  const supabase = createAdminClient();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, subtotal, payment_status')
    .eq('midtrans_order_id', orderId)
    .maybeSingle();

  if (orderError) {
    console.error('Unable to find order for Midtrans notification:', orderError.message);
    sendJson(response, 500, { error: 'Pesanan tidak dapat diverifikasi.' });
    return;
  }
  if (!order) {
    sendJson(response, 404, { error: 'Pesanan tidak ditemukan.' });
    return;
  }
  if (!Number.isFinite(Number(grossAmount)) || Number(order.subtotal) !== Number(grossAmount)) {
    sendJson(response, 400, { error: 'Total notifikasi tidak sesuai dengan pesanan.' });
    return;
  }

  const update = supabase
    .from('orders')
    .update({
      ...(orderStatus ? { status: orderStatus } : {}),
      payment_status: paymentStatus,
      midtrans_transaction_status: transactionStatus,
      payment_type: paymentType,
      payment_updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (paymentStatus === 'paid') {
    update.in('payment_status', ['pending', 'failed']);
  } else if (paymentStatus === 'failed') {
    update.eq('payment_status', 'pending');
  } else if (paymentStatus === 'pending') {
    update.eq('payment_status', 'pending');
  } else if (paymentStatus === 'partial_refunded') {
    update.in('payment_status', ['paid', 'partial_refunded']);
  } else if (paymentStatus === 'refunded') {
    update.in('payment_status', ['paid', 'partial_refunded', 'refunded']);
  } else if (paymentStatus === 'disputed') {
    update.in('payment_status', ['paid', 'partial_refunded', 'refunded', 'disputed']);
  } else {
    update.eq('payment_status', 'pending');
  }

  const { error: updateError } = await update;
  if (updateError) {
    console.error('Unable to update order from Midtrans notification:', updateError.message);
    sendJson(response, 500, { error: 'Status pesanan tidak dapat diperbarui.' });
    return;
  }

  sendJson(response, 200, { received: true });
}
