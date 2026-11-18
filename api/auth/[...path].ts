import { sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import login from '../../lib/backend/auth/login.js';
import me from '../../lib/backend/auth/me.js';
import refresh from '../../lib/backend/auth/refresh.js';
import register from '../../lib/backend/auth/register.js';

const handlers: Record<string, (request: VercelRequest, response: VercelResponse) => Promise<void>> = {
  login,
  me,
  refresh,
  register,
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
