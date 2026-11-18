import { requestBody, sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import { createAuthClient, isSupabaseAuthConfigured } from '../../lib/backend/supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  response.setHeader('Cache-Control', 'no-store');

  if (!isSupabaseAuthConfigured()) {
    sendJson(response, 503, { error: 'Autentikasi Supabase belum dikonfigurasi.' });
    return;
  }

  const body = requestBody(request);
  const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token.trim() : '';
  if (!refreshToken || refreshToken.length > 4096) {
    sendJson(response, 400, { error: 'Token sesi tidak valid.' });
    return;
  }

  const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    sendJson(response, 401, { error: 'Sesi tidak dapat diperbarui. Silakan masuk kembali.' });
    return;
  }

  sendJson(response, 200, {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
}
