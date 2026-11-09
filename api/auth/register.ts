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
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (name.length < 1 || name.length > 100) {
    sendJson(response, 400, { error: 'Nama harus 1–100 karakter.' });
    return;
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(response, 400, { error: 'Email tidak valid.' });
    return;
  }
  if (password.length < 8 || password.length > 128) {
    sendJson(response, 400, { error: 'Kata sandi harus 8–128 karakter.' });
    return;
  }

  const { data, error } = await createAuthClient().auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  if (error) {
    sendJson(response, 400, { error: 'Pendaftaran gagal. Periksa email dan kata sandi, lalu coba lagi.' });
    return;
  }

  sendJson(response, 201, {
    authenticated: Boolean(data.session),
    message: data.session
      ? 'Akun berhasil dibuat.'
      : 'Akun berhasil dibuat. Periksa email untuk verifikasi sebelum masuk.',
    ...(data.session && data.user
      ? {
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          },
          user: {
            id: data.user.id,
            email: data.user.email,
            name,
          },
        }
      : {}),
  });
}
