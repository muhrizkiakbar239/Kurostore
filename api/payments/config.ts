import '../../lib/backend/load-local-env.js';
import { sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  const clientKey = process.env.MIDTRANS_CLIENT_KEY ?? '';
  if (!clientKey) {
    sendJson(response, 503, { error: 'Midtrans client key belum dikonfigurasi.' });
    return;
  }

  sendJson(response, 200, {
    clientKey,
    environment: process.env.MIDTRANS_IS_PRODUCTION === 'true' ? 'production' : 'sandbox',
  });
}
