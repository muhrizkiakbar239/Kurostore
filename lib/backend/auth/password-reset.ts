import { createAdminClient, createAuthClient, isSupabaseAuthConfigured, isSupabaseConfigured } from '../supabase.js';
import { requestBody, sendJson, type VercelRequest, type VercelResponse } from '../http.js';
import { parseAuthIdentity } from './identity.js';
import { createPasswordRecoveryTicket, verifyPasswordRecoveryTicket } from './recovery-ticket.js';

const genericSendMessage = 'Jika akun ditemukan, kode OTP akan dikirim ke email atau nomor telepon tersebut.';

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
  const action = body?.action === undefined || body.action === 'send'
    ? 'send'
    : body.action === 'verify' || body.action === 'verify-code' || body.action === 'change-password'
      ? body.action
      : null;
  if (!action) {
    sendJson(response, 400, { error: 'Aksi pemulihan kata sandi tidak valid.' });
    return;
  }

  if (action === 'change-password') {
    if (!isSupabaseConfigured()) {
      sendJson(response, 503, { error: 'Penyimpanan akun Supabase belum dikonfigurasi.' });
      return;
    }

    const ticket = typeof body?.recovery_ticket === 'string' ? body.recovery_ticket : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const userId = secret ? verifyPasswordRecoveryTicket(ticket, secret) : null;
    if (!userId) {
      sendJson(response, 401, { error: 'Verifikasi OTP sudah kedaluwarsa. Minta kode baru lalu verifikasi lagi.' });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      sendJson(response, 400, { error: 'Kata sandi harus 8–128 karakter.' });
      return;
    }

    const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password });
    if (error) {
      console.error('Unable to update password after recovery:', error.message);
      const status = error.status ?? 503;
      sendJson(response, status >= 500 ? 503 : 400, {
        error: status >= 500
          ? 'Layanan pemulihan sedang tidak tersedia. Coba lagi nanti.'
          : 'Kata sandi tidak dapat diperbarui. Periksa ketentuannya lalu coba lagi.',
      });
      return;
    }

    sendJson(response, 200, { message: 'Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.' });
    return;
  }

  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
  const identity = parseAuthIdentity(identifier);
  if (!identity || identifier.length > 254) {
    sendJson(response, 400, { error: 'Masukkan email atau nomor telepon yang valid.' });
    return;
  }

  const auth = createAuthClient().auth;
  if (action === 'send') {
    const result = identity.type === 'email'
      ? await auth.resetPasswordForEmail(identity.email)
      : await auth.signInWithOtp({
          phone: identity.phone,
          options: { shouldCreateUser: false },
        });

    if (result.error) {
      if (result.error.status === 429) {
        sendJson(response, 429, { error: 'Terlalu banyak permintaan OTP. Coba lagi nanti.' });
        return;
      }
      console.error('Unable to send password recovery OTP:', result.error.message);
      const status = result.error.status ?? 503;
      if (status !== 400) {
        sendJson(response, 503, { error: 'Layanan email atau SMS belum siap. Periksa konfigurasi OTP Supabase lalu coba lagi.' });
        return;
      }
    }

    sendJson(response, 202, {
      message: genericSendMessage,
      method: identity.type,
    });
    return;
  }

  if (action === 'verify-code' && !isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Penyimpanan akun Supabase belum dikonfigurasi.' });
    return;
  }

  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^\d{4,10}$/.test(code)
    || (action === 'verify' && (password.length < 8 || password.length > 128))) {
    sendJson(response, 400, { error: 'Kode OTP atau kata sandi baru tidak valid.' });
    return;
  }

  const verification = identity.type === 'email'
    ? await auth.verifyOtp({ email: identity.email, token: code, type: 'recovery' })
    : await auth.verifyOtp({
        phone: identity.phone,
        token: code,
        type: 'sms',
      });

  if (verification.error || !verification.data.session) {
    if (verification.error?.status === 429) {
      sendJson(response, 429, { error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      return;
    }
    if (verification.error && (verification.error.status ?? 503) >= 500) {
      console.error('Unable to verify password recovery OTP:', verification.error.message);
      sendJson(response, 503, { error: 'Layanan verifikasi sedang tidak tersedia. Coba lagi nanti.' });
      return;
    }
    sendJson(response, 400, { error: 'Kode OTP salah atau sudah kedaluwarsa. Minta kode baru lalu coba lagi.' });
    return;
  }

  if (action === 'verify-code') {
    if (!verification.data.user) {
      sendJson(response, 400, { error: 'Akun untuk kode OTP tidak ditemukan.' });
      return;
    }

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) {
      sendJson(response, 503, { error: 'Penyimpanan akun Supabase belum dikonfigurasi.' });
      return;
    }

    sendJson(response, 200, {
      recovery_ticket: createPasswordRecoveryTicket(verification.data.user.id, secret),
    });
    return;
  }

  const { error } = await auth.updateUser({ password });
  if (error) {
    console.error('Unable to update password after recovery:', error.message);
    const status = error.status ?? 503;
    sendJson(response, status >= 500 ? 503 : 400, {
      error: status >= 500
        ? 'Layanan pemulihan sedang tidak tersedia. Coba lagi nanti.'
        : 'Kata sandi tidak dapat diperbarui. Periksa ketentuannya lalu coba lagi.',
    });
    return;
  }

  sendJson(response, 200, { message: 'Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.' });
}
