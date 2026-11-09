import { requireRole } from '../../lib/backend/auth.js';
import { sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../../lib/backend/supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Backend Supabase belum dikonfigurasi.' });
    return;
  }

  const account = await requireRole(request, response, createAdminClient(), ['buyer', 'seller', 'admin']);
  if (!account) return;

  sendJson(response, 200, {
    user: {
      id: account.user.id,
      email: account.user.email,
      role: account.roles[0],
      roles: account.roles,
    },
  });
}
