import { requireRole } from '../../lib/backend/auth.js';
import { requestBody, sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../../lib/backend/supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Backend Supabase belum dikonfigurasi.' });
    return;
  }

  const supabase = createAdminClient();

  if (request.method === 'GET') {
    const applicant = await requireRole(request, response, supabase, ['buyer', 'seller']);
    if (!applicant) return;

    let query = supabase
      .from('seller_applications')
      .select('id, store_name, store_description, status, submitted_at, reviewed_at, rejection_reason')
      .order('submitted_at', { ascending: false })
      .limit(20);

    query = query.eq('user_id', applicant.user.id);

    const { data, error } = await query;
    if (error) {
      console.error('Unable to fetch seller applications:', error.message);
      sendJson(response, 500, { error: 'Pengajuan seller tidak dapat dimuat.' });
      return;
    }

    sendJson(response, 200, { applications: data });
    return;
  }

  const applicant = await requireRole(request, response, supabase, ['buyer']);
  if (!applicant) return;

  const body = requestBody(request);
  const storeName = typeof body?.store_name === 'string' ? body.store_name.trim() : '';
  const storeDescription = typeof body?.store_description === 'string'
    ? body.store_description.trim()
    : '';

  if (storeName.length < 2 || storeName.length > 80 || storeDescription.length > 500) {
    sendJson(response, 400, { error: 'Nama toko harus 2–80 karakter dan deskripsi maksimal 500 karakter.' });
    return;
  }

  const { data, error } = await supabase
    .from('seller_applications')
    .insert({
      user_id: applicant.user.id,
      store_name: storeName,
      store_description: storeDescription,
    })
    .select('id, store_name, store_description, status, submitted_at')
    .single();

  if (error?.code === '23505') {
    sendJson(response, 409, { error: 'Pengajuan seller yang masih menunggu sudah ada.' });
    return;
  }
  if (error || !data) {
    console.error('Unable to create seller application:', error?.message ?? 'No application returned.');
    sendJson(response, 500, { error: 'Pengajuan seller tidak dapat disimpan.' });
    return;
  }

  sendJson(response, 201, { application: data });
}
