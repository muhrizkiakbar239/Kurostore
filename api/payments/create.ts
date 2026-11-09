import '../../lib/backend/load-local-env.js';
import midtransClient from 'midtrans-client';
import { requireRole } from '../../lib/backend/auth.js';
import { requestBody, sendJson, validUuid, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../../lib/backend/supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
  const clientKey = process.env.MIDTRANS_CLIENT_KEY ?? '';
  if (!serverKey || !clientKey) {
    sendJson(response, 503, { error: 'Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Database produk belum dikonfigurasi.' });
    return;
  }

  const body = requestBody(request);
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const paymentMethod = typeof body?.paymentMethod === 'string' ? body.paymentMethod : 'all';
  const customer = body && typeof body.customer === 'object' && body.customer !== null
    ? body.customer as Record<string, unknown>
    : {};

  const enabledPaymentMethods: Record<string, string[]> = {
    qris: ['qris'],
    ewallet: ['gopay', 'shopeepay', 'dana', 'linkaja'],
    bank_transfer: ['bank_transfer', 'echannel'],
    credit_card: ['credit_card'],
  };
  if (paymentMethod !== 'all' && !enabledPaymentMethods[paymentMethod]) {
    sendJson(response, 400, { error: 'Metode pembayaran tidak valid.' });
    return;
  }

  if (rawItems.length === 0 || rawItems.length > 50) {
    sendJson(response, 400, { error: 'Jumlah produk checkout tidak valid.' });
    return;
  }

  const requestedItems = rawItems.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const product = item as Record<string, unknown>;
    if (!validUuid(product.productId)
      || !Number.isInteger(product.quantity)
      || Number(product.quantity) < 1
      || Number(product.quantity) > 999) return null;
    return { id: product.productId, quantity: Number(product.quantity) };
  });

  if (requestedItems.some((item) => item === null)) {
    sendJson(response, 400, { error: 'Data produk yang dibeli tidak valid.' });
    return;
  }

  const items = requestedItems.filter((item): item is { id: string; quantity: number } => item !== null);
  const uniqueProductIds = new Set(items.map((item) => item.id));
  if (uniqueProductIds.size !== items.length) {
    sendJson(response, 400, { error: 'Produk duplikat tidak boleh dikirim dalam checkout.' });
    return;
  }

  const supabase = createAdminClient();
  const account = await requireRole(request, response, supabase, ['buyer', 'seller', 'admin']);
  if (!account) return;

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, seller_id, name, price, stock, status')
    .in('id', items.map((item) => item.id));

  if (productsError) {
    console.error('Unable to verify checkout products:', productsError.message);
    sendJson(response, 500, { error: 'Produk checkout tidak dapat diverifikasi.' });
    return;
  }

  if (!products || products.length !== items.length) {
    sendJson(response, 400, { error: 'Satu atau lebih produk tidak tersedia.' });
    return;
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const parsedItems = items.map((item) => {
    const product = productById.get(item.id);
    if (!product || product.status !== 'active' || product.stock < item.quantity) return null;
    const price = Math.round(Number(product.price));
    if (!product.name || !Number.isFinite(price) || price <= 0) return null;
    return {
      id: product.id,
      sellerId: product.seller_id,
      name: product.name.slice(0, 50),
      price,
      quantity: item.quantity,
    };
  });

  if (parsedItems.some((item) => item === null)) {
    sendJson(response, 400, { error: 'Stok produk berubah atau ada produk yang tidak lagi tersedia.' });
    return;
  }

  const validItems = parsedItems.filter((item): item is NonNullable<typeof item> => item !== null);
  const firstName = typeof customer.firstName === 'string' ? customer.firstName.trim() : '';
  const lastName = typeof customer.lastName === 'string' ? customer.lastName.trim() : '';
  const email = typeof customer.email === 'string' ? customer.email.trim() : '';
  const phone = typeof customer.phone === 'string' ? customer.phone.trim() : '';
  const address = typeof customer.address === 'string' ? customer.address.trim() : '';
  const city = typeof customer.city === 'string' ? customer.city.trim() : '';
  const postalCode = typeof customer.postalCode === 'string' ? customer.postalCode.trim() : '';

  if (!firstName || firstName.length > 100 || lastName.length > 100
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || !phone || phone.length > 30 || !address || address.length > 300
    || !city || city.length > 100 || !postalCode || postalCode.length > 10) {
    sendJson(response, 400, { error: 'Informasi penerima atau alamat pengiriman tidak valid.' });
    return;
  }

  const grossAmount = validItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    sendJson(response, 400, { error: 'Total pembayaran tidak valid.' });
    return;
  }

  const orderId = `KUR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey,
    clientKey,
  });

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_id: account.user.id,
      status: 'pending',
      payment_status: 'pending',
      subtotal: grossAmount,
      midtrans_order_id: orderId,
      shipping_address: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        address,
        city,
        postal_code: postalCode,
      },
    })
    .select('id')
    .single();

  if (orderError || !order) {
    console.error('Unable to create checkout order:', orderError?.message ?? 'Order ID not returned.');
    sendJson(response, 500, { error: 'Pesanan tidak dapat disimpan.' });
    return;
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(validItems.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      seller_id: item.sellerId,
      product_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
    })));

  if (itemsError) {
    console.error('Unable to save checkout order items:', itemsError.message);
    const { error: cleanupError } = await supabase.from('orders').delete().eq('id', order.id);
    if (cleanupError) {
      console.error('Unable to remove incomplete checkout order:', cleanupError.message);
    }
    sendJson(response, 500, { error: 'Detail pesanan tidak dapat disimpan.' });
    return;
  }

  try {
    const transactionRequest: Record<string, unknown> = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      item_details: validItems.map((item) => ({
        id: item.id,
        price: item.price,
        quantity: item.quantity,
        name: item.name,
      })),
      customer_details: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        shipping_address: {
          first_name: firstName,
          last_name: lastName,
          phone,
          address,
          city,
          postal_code: postalCode,
          country_code: 'IDN',
        },
      },
    };
    if (paymentMethod !== 'all') {
      transactionRequest.enabled_payments = enabledPaymentMethods[paymentMethod];
    }

    const transaction = await snap.createTransaction(transactionRequest);
    if (!transaction.token || !transaction.redirect_url) {
      throw new Error('Midtrans tidak mengembalikan token transaksi.');
    }

    sendJson(response, 200, {
      orderId,
      grossAmount,
      token: transaction.token,
      redirectUrl: transaction.redirect_url,
      environment: process.env.MIDTRANS_IS_PRODUCTION === 'true' ? 'production' : 'sandbox',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pembayaran tidak dapat dibuat.';
    console.error('Midtrans transaction creation failed:', message);
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        payment_status: 'failed',
        midtrans_transaction_status: 'creation_failed',
        payment_updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);
    if (updateError) {
      console.error('Unable to mark failed checkout order:', updateError.message);
    }
    sendJson(response, 502, { error: 'Pembayaran gagal dibuat. Cek konfigurasi Midtrans sandbox Anda.' });
  }
}
