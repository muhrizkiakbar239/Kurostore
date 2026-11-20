import { requestBody, sendJson, type VercelRequest, type VercelResponse } from '../http.js';
import { createAdminClient, createAuthClient, isSupabaseConfigured } from '../supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }
  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Autentikasi Supabase belum dikonfigurasi.' });
    return;
  }

  const body = requestBody(request);
  const accessToken = typeof body?.access_token === 'string' ? body.access_token.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (accessToken.length < 20 || accessToken.length > 4096
    || password.length < 8 || password.length > 128) {
    sendJson(response, 400, { error: 'Tautan undangan tidak valid atau kata sandi belum memenuhi syarat.' });
    return;
  }

  const { data: authData, error: authError } = await createAuthClient().auth.getUser(accessToken);
  if (authError || !authData.user) {
    sendJson(response, 401, { error: 'Tautan undangan sudah kedaluwarsa atau tidak valid. Minta undangan baru.' });
    return;
  }

  if (!authData.user.invited_at || !authData.user.email) {
    sendJson(response, 403, { error: 'Tautan ini bukan undangan seller yang valid.' });
    return;
  }
  if (authData.user.app_metadata.kurostore_invite_accepted === true) {
    sendJson(response, 409, { error: 'Undangan ini sudah digunakan. Masuk dengan kata sandi yang telah dibuat.' });
    return;
  }

  const admin = createAdminClient();
  const { data: seller, error: sellerError } = await admin
    .from('seller_profiles')
    .select('user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (sellerError) {
    console.error('Unable to verify invited seller account:', sellerError.message);
    sendJson(response, 500, { error: 'Akun seller tidak dapat diverifikasi saat ini.' });
    return;
  }
  if (!seller) {
    sendJson(response, 403, { error: 'Undangan ini tidak terhubung ke akun seller.' });
    return;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(authData.user.id, {
    password,
    app_metadata: {
      ...authData.user.app_metadata,
      kurostore_invite_accepted: true,
    },
  });
  if (updateError) {
    console.error('Unable to set password for invited seller:', updateError.message);
    sendJson(response, 500, { error: 'Kata sandi tidak dapat disimpan saat ini. Coba lagi.' });
    return;
  }

  sendJson(response, 200, { accepted: true, email: authData.user.email });
}
