import type { Session, User } from '@supabase/supabase-js';

export type AuthIdentity = { type: 'email'; email: string } | { type: 'phone'; phone: string };

export function normalizePhoneNumber(input: string): string | null {
  const compact = input.trim().replace(/[\s().-]/g, '');
  if (!compact) return null;

  let phone = compact;
  if (/^0\d+$/.test(compact)) {
    phone = `+62${compact.slice(1)}`;
  } else if (/^62\d+$/.test(compact)) {
    phone = `+${compact}`;
  } else if (/^8\d+$/.test(compact)) {
    phone = `+62${compact}`;
  }

  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function parseAuthIdentity(input: string): AuthIdentity | null {
  const value = input.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { type: 'email', email: value.toLowerCase() };
  }

  const phone = normalizePhoneNumber(value);
  return phone ? { type: 'phone', phone } : null;
}

export function authSessionPayload(session: Session, user: User, name = '') {
  return {
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
    user: {
      id: user.id,
      email: user.email,
      name: name || (typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : ''),
    },
  };
}
