import { sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import bootstrap from '../../lib/admin/bootstrap.js';
import overview from '../../lib/admin/overview.js';
import sellerApplications from '../../lib/admin/seller-applications.js';
import systemHealth from '../../lib/admin/system-health.js';

const handlers: Record<string, (request: VercelRequest, response: VercelResponse) => Promise<void>> = {
  bootstrap,
  overview,
  'seller-applications': sellerApplications,
  'system-health': systemHealth,
};

export default function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname
    .replace(/\/+$/, '')
    .split('/')
    .pop();
  const routeHandler = path ? handlers[path] : undefined;

  if (!routeHandler) {
    sendJson(response, 404, { error: 'Endpoint tidak ditemukan.' });
    return Promise.resolve();
  }

  return routeHandler(request, response);
}
