import { sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import login from '../../lib/backend/auth/login.js';
import google from '../../lib/backend/auth/google.js';
import me from '../../lib/backend/auth/me.js';
import refresh from '../../lib/backend/auth/refresh.js';
import register from '../../lib/backend/auth/register.js';
import changePassword from '../../lib/backend/auth/change-password.js';
import acceptInvite from '../../lib/backend/auth/accept-invite.js';
import verifyOtp from '../../lib/backend/auth/verify-otp.js';
import resendSignupOtp from '../../lib/backend/auth/resend-signup-otp.js';
import passwordReset from '../../lib/backend/auth/password-reset.js';
import phoneOtp from '../../lib/backend/auth/phone-otp.js';

const handlers: Record<string, (request: VercelRequest, response: VercelResponse) => Promise<void>> = {
  login,
  google,
  me,
  refresh,
  register,
  'verify-otp': verifyOtp,
  'resend-signup-otp': resendSignupOtp,
  'password-reset': passwordReset,
  'phone-otp': phoneOtp,
  'change-password': changePassword,
  'accept-invite': acceptInvite,
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
