import { requestBody, sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import { createAuthClient, isSupabaseAuthConfigured } from '../../lib/backend/supabase.js';

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
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length === 0 || password.length > 128) {
    sendJson(response, 400, { error: 'Email atau kata sandi tidak valid.' });
    return;
  }

  const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    sendJson(response, 401, { error: 'Email atau kata sandi salah, atau email belum diverifikasi.' });
    return;
  }

  sendJson(response, 200, {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    user: {
      id: data.user.id,
      email: data.user.email,
      name: typeof data.user.user_metadata.full_name === 'string'
        ? data.user.user_metadata.full_name
        : '',
    },
  });
}
