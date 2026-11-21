import { requestBody, sendJson, type VercelRequest, type VercelResponse } from '../http.js';
import { createAdminClient, createAuthClient, isSupabaseAuthConfigured, isSupabaseConfigured } from '../supabase.js';
import { parseAuthIdentity } from './identity.js';

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
  const identifier = typeof body?.identifier === 'string'
    ? body.identifier.trim()
    : typeof body?.email === 'string'
      ? body.email.trim()
      : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const identity = parseAuthIdentity(identifier);

  if (!identity || identifier.length > 254 || password.length === 0 || password.length > 128) {
    sendJson(response, 400, { error: 'Email/nomor telepon atau kata sandi tidak valid.' });
    return;
  }

  const credentials = identity.type === 'phone'
    ? { phone: identity.phone, password }
    : { email: identity.email, password };
  const { data, error } = await createAuthClient().auth.signInWithPassword(credentials);
  if (error || !data.session) {
    if (error?.status === 429) {
      sendJson(response, 429, { error: 'Terlalu banyak percobaan masuk. Coba lagi nanti.' });
      return;
    }
    if (error && (error.status ?? 503) >= 500) {
      console.error('Unable to sign in:', error.message);
      sendJson(response, 503, { error: 'Layanan masuk sedang tidak tersedia. Coba lagi nanti.' });
      return;
    }
    sendJson(response, 401, { error: 'Email/nomor telepon atau kata sandi salah, atau akun belum diverifikasi.' });
    return;
  }

  let name = typeof data.user.user_metadata.full_name === 'string'
    ? data.user.user_metadata.full_name
    : '';
  if (isSupabaseConfigured()) {
    const { data: profile, error: profileError } = await createAdminClient()
      .from('profiles')
      .select('full_name')
      .eq('id', data.user.id)
      .maybeSingle();
    if (profileError) {
      console.error('Unable to load account name after sign in:', profileError.message);
    } else if (profile && typeof profile.full_name === 'string') {
      name = profile.full_name;
    }
  }

  sendJson(response, 200, {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    user: {
      id: data.user.id,
      email: data.user.email,
      name,
    },
  });
}
