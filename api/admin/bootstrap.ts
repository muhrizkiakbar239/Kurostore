import { timingSafeEqual } from 'node:crypto';
import { authenticatedUser } from '../../lib/backend/auth.js';
import { sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../../lib/backend/supabase.js';

function isValidBootstrapToken(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Backend Supabase belum dikonfigurasi.' });
    return;
  }

  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!bootstrapEmail || !bootstrapToken) {
    sendJson(response, 503, { error: 'Konfigurasi bootstrap admin belum lengkap.' });
    return;
  }

  const supabase = createAdminClient();
  const user = await authenticatedUser(request, response, supabase);
  if (!user) return;

  if (user.email?.trim().toLowerCase() !== bootstrapEmail || !user.email_confirmed_at) {
    sendJson(response, 403, { error: 'Akun harus memakai email bootstrap yang sudah terverifikasi.' });
    return;
  }

  const suppliedToken = request.headers['x-admin-bootstrap-token'];
  const token = typeof suppliedToken === 'string' ? suppliedToken : undefined;
  if (!isValidBootstrapToken(token, bootstrapToken)) {
    sendJson(response, 403, { error: 'Token bootstrap admin tidak valid.' });
    return;
  }

  const { error } = await supabase.rpc('bootstrap_first_admin', {
    target_user_id: user.id,
    expected_email: bootstrapEmail,
  });

  if (error?.message.includes('ADMIN_ALREADY_EXISTS')) {
    sendJson(response, 409, { error: 'Admin pertama sudah dibuat; bootstrap tidak dapat digunakan lagi.' });
    return;
  }
  if (error) {
    console.error('Unable to bootstrap first admin:', error.message);
    sendJson(response, 403, { error: 'Akun ini tidak memenuhi syarat untuk menjadi admin pertama.' });
    return;
  }

  sendJson(response, 201, { role: 'admin' });
}
