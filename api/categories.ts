import { sendJson, type VercelRequest, type VercelResponse } from '../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../lib/backend/supabase.js';

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

  const { data, error } = await createAdminClient()
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Unable to fetch public categories:', error.message);
    sendJson(response, 500, { error: 'Kategori tidak dapat dimuat saat ini.' });
    return;
  }

  sendJson(response, 200, { categories: data });
}
