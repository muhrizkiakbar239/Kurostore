import { bearerToken, requestBody, sendJson, type VercelRequest, type VercelResponse } from '../http.js';
import { createAdminClient, createAuthClient, isSupabaseAuthConfigured, isSupabaseConfigured } from '../supabase.js';
import { normalizePhoneNumber } from './identity.js';

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

  const accessToken = bearerToken(request);
  const body = requestBody(request);
  const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token : '';
  const phone = typeof body?.phone === 'string' ? normalizePhoneNumber(body.phone) : null;
  const action = body?.action;
  if (!accessToken || !refreshToken) {
    sendJson(response, 401, { error: 'Sesi tidak valid. Silakan daftar kembali atau masuk lagi.' });
    return;
  }
  if (!phone) {
    sendJson(response, 400, { error: 'Nomor telepon tidak valid.' });
    return;
  }
  if (action !== 'send' && action !== 'verify') {
    sendJson(response, 400, { error: 'Aksi verifikasi nomor tidak valid.' });
    return;
  }

  const supabase = createAuthClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError || !sessionData.user || !sessionData.session) {
    if (sessionError && (sessionError.status ?? 503) >= 500) {
      console.error('Unable to restore session for phone verification:', sessionError.message);
      sendJson(response, 503, { error: 'Sesi akun tidak dapat diverifikasi saat ini. Coba lagi nanti.' });
      return;
    }
    sendJson(response, 401, { error: 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.' });
    return;
  }

  if (action === 'send') {
    const { error } = await supabase.auth.updateUser({ phone });
    if (error) {
      if (error.status === 429) {
        sendJson(response, 429, { error: 'Terlalu banyak permintaan SMS. Coba lagi nanti.' });
        return;
      }
      console.error('Unable to send phone verification OTP:', error.message);
      if (error.status === 422) {
        sendJson(response, 409, { error: 'Nomor telepon sudah terhubung ke akun lain.' });
        return;
      }
      const status = error.status ?? 503;
      sendJson(response, status >= 500 ? 503 : 400, {
        error: status >= 500
          ? 'Layanan SMS sedang tidak tersedia. Pastikan provider SMS Supabase sudah dikonfigurasi.'
          : 'Kode SMS tidak dapat dikirim. Periksa nomor telepon lalu coba lagi.',
      });
      return;
    }

    const { data: refreshed } = await supabase.auth.getSession();
    sendJson(response, 200, {
      message: 'Kode verifikasi dikirim lewat SMS.',
      session: refreshed.session
        ? {
            access_token: refreshed.session.access_token,
            refresh_token: refreshed.session.refresh_token,
          }
        : {
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token,
          },
    });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Penyimpanan profil Supabase belum dikonfigurasi.' });
    return;
  }

  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!/^\d{4,10}$/.test(code)) {
    sendJson(response, 400, { error: 'Kode OTP tidak valid.' });
    return;
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: 'phone_change',
  });
  if (error || !data.user) {
    if (error?.status === 429) {
      sendJson(response, 429, { error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      return;
    }
    if (error && (error.status ?? 503) >= 500) {
      console.error('Unable to verify phone OTP:', error.message);
      sendJson(response, 503, { error: 'Layanan verifikasi SMS sedang tidak tersedia. Coba lagi nanti.' });
      return;
    }
    sendJson(response, 400, { error: 'Kode SMS salah atau sudah kedaluwarsa. Coba lagi.' });
    return;
  }

  const { error: profileError } = await createAdminClient()
    .from('profiles')
    .update({ phone })
    .eq('id', data.user.id);
  if (profileError) {
    console.error('Unable to update profile phone after verification:', profileError.message);
    sendJson(response, 500, { error: 'Nomor sudah terverifikasi, tetapi profil belum dapat diperbarui.' });
    return;
  }

  const { data: currentSession } = await supabase.auth.getSession();
  if (!currentSession.session) {
    sendJson(response, 500, { error: 'Nomor terverifikasi, tetapi sesi akun tidak dapat dipulihkan. Silakan masuk kembali.' });
    return;
  }

  sendJson(response, 200, {
    message: 'Nomor telepon berhasil diverifikasi.',
    session: {
      access_token: currentSession.session.access_token,
      refresh_token: currentSession.session.refresh_token,
    },
    user: {
      id: data.user.id,
      email: data.user.email,
      name: typeof data.user.user_metadata.full_name === 'string' ? data.user.user_metadata.full_name : '',
    },
  });
}
