import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { validUuid } from '../http.js';

const ticketLifetimeMs = 5 * 60 * 1000;

export function createPasswordRecoveryTicket(userId: string, secret: string): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Date.now() + ticketLifetimeMs,
    nonce: randomBytes(16).toString('hex'),
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyPasswordRecoveryTicket(ticket: string, secret: string): string | null {
  const [payload, signature, extra] = ticket.split('.');
  if (!payload || !signature || extra !== undefined) return null;

  const expectedSignature = createHmac('sha256', secret).update(payload).digest();
  const providedSignature = Buffer.from(signature, 'base64url');
  if (providedSignature.length !== expectedSignature.length
    || !timingSafeEqual(providedSignature, expectedSignature)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const data = parsed as { userId?: unknown; expiresAt?: unknown };
    if (!validUuid(data.userId)
      || typeof data.expiresAt !== 'number'
      || data.expiresAt <= Date.now()) {
      return null;
    }

    return data.userId;
  } catch {
    return null;
  }
}
