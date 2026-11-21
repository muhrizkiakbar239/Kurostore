import { requestBody, sendJson, type VercelRequest, type VercelResponse } from '../http.js';
import { createAuthClient, isSupabaseAuthConfigured } from '../supabase.js';
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

  const body = requestBody(request);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const phoneInput = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const phone = phoneInput ? normalizePhoneNumber(phoneInput) : null;

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
  if (phoneInput && !phone) {
    sendJson(response, 400, { error: 'Nomor telepon tidak valid. Gunakan format Indonesia, misalnya 08xxxxxxxxxx.' });
    return;
  }

  const { data, error } = await createAuthClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        ...(phone ? { pending_phone: phone } : {}),
      },
    },
  });

  if (error) {
    const status = error.status ?? 503;
    if (status >= 500) {
      console.error('Unable to register account:', error.message);
      sendJson(response, 503, { error: 'Layanan pendaftaran sedang tidak tersedia. Coba lagi nanti.' });
      return;
    }
    sendJson(response, 400, { error: 'Pendaftaran gagal. Periksa email dan kata sandi, lalu coba lagi.' });
    return;
  }

  if (data.session) {
    console.error('Email confirmation is disabled; signup OTP cannot be enforced.');
    sendJson(response, 503, {
      error: 'Verifikasi email belum diwajibkan di Supabase. Aktifkan konfirmasi email agar pendaftaran memakai OTP.',
    });
    return;
  }

  sendJson(response, 202, {
    verificationRequired: true,
    email,
    phone,
    message: 'Kode OTP telah dikirim ke email. Masukkan kode tersebut untuk mengaktifkan akun.',
  });
}
