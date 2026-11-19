import { requireRole } from '../auth.js';
import { requestBody, sendJson, type VercelRequest, type VercelResponse } from '../http.js';
import { createAdminClient, createAuthClient, isSupabaseConfigured } from '../supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }
  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Autentikasi akun belum dikonfigurasi.' });
    return;
  }

  const supabase = createAdminClient();
  const account = await requireRole(request, response, supabase, ['buyer', 'seller', 'admin']);
  if (!account) return;

  const body = requestBody(request);
  const currentPassword = typeof body?.current_password === 'string' ? body.current_password : '';
  const newPassword = typeof body?.new_password === 'string' ? body.new_password : '';
  if (!account.user.email
    || currentPassword.length < 1
    || currentPassword.length > 128
    || newPassword.length < 8
    || newPassword.length > 128
    || currentPassword === newPassword) {
    sendJson(response, 400, { error: 'Kata sandi baru harus berbeda dan memiliki 8–128 karakter.' });
    return;
  }

  const { error: verifyError } = await createAuthClient().auth.signInWithPassword({
    email: account.user.email,
    password: currentPassword,
  });
  if (verifyError) {
    if (verifyError.status !== 400 && verifyError.status !== 401 && verifyError.status !== 403) {
      console.error('Unable to verify current account password:', verifyError.message);
      sendJson(response, verifyError.status === 429 ? 429 : 503, {
        error: verifyError.status === 429
          ? 'Layanan autentikasi sedang membatasi permintaan. Coba lagi nanti.'
          : 'Autentikasi sedang tidak tersedia. Coba lagi sebentar lagi.',
      });
      return;
    }
    sendJson(response, 401, { error: 'Kata sandi saat ini tidak sesuai.' });
    return;
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(account.user.id, {
    password: newPassword,
  });
  if (updateError) {
    console.error('Unable to update account password:', updateError.message);
    sendJson(response, 500, { error: 'Kata sandi tidak dapat diperbarui saat ini.' });
    return;
  }

  sendJson(response, 200, { updated: true });
}
