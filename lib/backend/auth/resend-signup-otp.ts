import { requestBody, sendJson, type VercelRequest, type VercelResponse } from '../http.js';
import { createAuthClient, isSupabaseAuthConfigured } from '../supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  if (!isSupabaseAuthConfigured()) {
    sendJson(response, 503, { error: 'Autentikasi Supabase belum dikonfigurasi.' });
    return;
  }

  const body = requestBody(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(response, 400, { error: 'Email tidak valid.' });
    return;
  }

  const { error } = await createAuthClient().auth.resend({ type: 'signup', email });
  if (error) {
    if (error.status === 429) {
      sendJson(response, 429, { error: 'Terlalu banyak permintaan OTP. Coba lagi nanti.' });
      return;
    }
    console.error('Unable to resend signup OTP:', error.message);
    const status = error.status ?? 503;
    sendJson(response, status >= 500 ? 503 : 400, {
      error: status >= 500
        ? 'Layanan email sedang tidak tersedia. Coba lagi nanti.'
        : 'Kode OTP tidak dapat dikirim ulang. Periksa email atau coba lagi nanti.',
    });
    return;
  }

  sendJson(response, 200, { message: 'Jika pendaftaran belum terverifikasi, kode OTP baru akan dikirim ke email.' });
}
