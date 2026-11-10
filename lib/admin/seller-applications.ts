import { requireRole } from '../backend/auth.js';
import { requestBody, sendJson, validUuid, type VercelRequest, type VercelResponse } from '../backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../backend/supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'PATCH') {
    response.setHeader('Allow', 'GET, PATCH');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Backend Supabase belum dikonfigurasi.' });
    return;
  }

  const supabase = createAdminClient();
  const admin = await requireRole(request, response, supabase, ['admin']);
  if (!admin) return;

  if (request.method === 'GET') {
    const { data, error } = await supabase
      .from('seller_applications')
      .select('id, user_id, store_name, store_description, status, submitted_at')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Unable to fetch pending seller applications:', error.message);
      sendJson(response, 500, { error: 'Daftar pengajuan tidak dapat dimuat.' });
      return;
    }

    sendJson(response, 200, { applications: data });
    return;
  }

  const body = requestBody(request);
  const applicationId = body?.application_id;
  const decision = body?.decision;
  const reason = typeof body?.rejection_reason === 'string' ? body.rejection_reason.trim() : '';

  if (!validUuid(applicationId) || (decision !== 'approved' && decision !== 'rejected')) {
    sendJson(response, 400, { error: 'Pengajuan atau keputusan tidak valid.' });
    return;
  }
  if (decision === 'rejected' && reason.length > 500) {
    sendJson(response, 400, { error: 'Alasan penolakan maksimal 500 karakter.' });
    return;
  }

  const { error } = await supabase.rpc('review_seller_application', {
    target_application_id: applicationId,
    decision,
    reviewer_id: admin.user.id,
    decision_reason: decision === 'rejected' ? reason : null,
  });

  if (error?.message.includes('APPLICATION_NOT_PENDING')) {
    sendJson(response, 409, { error: 'Pengajuan sudah ditinjau atau tidak ditemukan.' });
    return;
  }
  if (error) {
    console.error('Unable to review seller application:', error.message);
    sendJson(response, 500, { error: 'Keputusan pengajuan tidak dapat disimpan.' });
    return;
  }

  sendJson(response, 200, { application_id: applicationId, status: decision });
}
