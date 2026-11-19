import type { SupabaseClient } from '@supabase/supabase-js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendOrderStatusEmail(options: {
  to: string;
  orderId: string;
  status: 'paid' | 'failed';
  amount: number;
  kind?: 'order' | 'wallet_topup';
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY ?? '';
  const from = process.env.RESEND_FROM_EMAIL ?? '';
  if (!apiKey || !from) {
    throw new Error('Resend is not configured.');
  }

  const paid = options.status === 'paid';
  const isTopup = options.kind === 'wallet_topup';
  const subject = isTopup
    ? paid ? 'Top up demo KuroPay berhasil' : 'Top up demo KuroPay gagal'
    : paid ? 'Pembayaran Kurostore berhasil' : 'Pembayaran Kurostore gagal';
  const subjectText = isTopup ? 'Top up demo KuroPay' : 'Pembayaran pesanan';
  const statusText = paid ? 'berhasil dikonfirmasi' : 'gagal atau dibatalkan';
  const amount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(options.amount);
  const safeOrderId = escapeHtml(options.orderId);
  const safeAmount = escapeHtml(amount);
  const html = `<p>${escapeHtml(subjectText)} <strong>${safeOrderId}</strong> ${statusText}.</p><p>Total transaksi: <strong>${safeAmount}</strong>.</p><p>Periksa status terbaru melalui akun Kurostore.</p>`;
  const text = `${subjectText} ${options.orderId} ${statusText}. Total transaksi: ${amount}. Periksa status terbaru melalui akun Kurostore.`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [options.to], subject, html, text }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend request failed (${response.status}): ${body.slice(0, 500)}`);
  }
}

export async function sendPaymentStatusEmailIfEnabled(
  supabase: SupabaseClient,
  options: {
    userId: string;
    orderId: string;
    status: 'paid' | 'failed';
    amount: number;
    kind?: 'order' | 'wallet_topup';
  },
): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;

  try {
    const [{ data: preferences, error: preferencesError }, { data: userData, error: userError }] = await Promise.all([
      supabase.from('account_preferences').select('email_order_updates').eq('user_id', options.userId).maybeSingle(),
      supabase.auth.admin.getUserById(options.userId),
    ]);
    if (preferencesError || userError) {
      console.error('Unable to check email notification settings:', preferencesError?.message ?? userError?.message);
      return;
    }
    if (preferences?.email_order_updates !== true) return;

    const to = userData.user.email ?? '';
    if (!to) {
      console.error('Email notification skipped because the account has no email address.');
      return;
    }

    await sendOrderStatusEmail({
      to,
      orderId: options.orderId,
      status: options.status,
      amount: options.amount,
      kind: options.kind,
    });
  } catch (error) {
    console.error('Unable to prepare or send payment status email:', error instanceof Error ? error.message : 'Unknown email error.');
  }
}
