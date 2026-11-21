import { authSessionPayload } from './identity.js';
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
  const token = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4,10}$/.test(token)) {
    sendJson(response, 400, { error: 'Email atau kode OTP tidak valid.' });
    return;
  }

  const { data, error } = await createAuthClient().auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });

  if (error || !data.session || !data.user) {
    if (error?.status === 429) {
      sendJson(response, 429, { error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      return;
    }
    if (error && (error.status ?? 503) >= 500) {
      console.error('Unable to verify signup OTP:', error.message);
      sendJson(response, 503, { error: 'Layanan verifikasi sedang tidak tersedia. Coba lagi nanti.' });
      return;
    }
    sendJson(response, 400, { error: 'Kode OTP salah atau sudah kedaluwarsa. Periksa kode lalu coba lagi.' });
    return;
  }

  sendJson(response, 200, authSessionPayload(data.session, data.user));
}
