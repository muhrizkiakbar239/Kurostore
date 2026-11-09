import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bearerToken, sendJson, type VercelRequest, type VercelResponse } from './http.js';

export type AccountRole = 'buyer' | 'seller' | 'admin';
const dualRoleAdminEmail = 'muhrizkiakbar239@gmail.com';

function isAccountRole(role: unknown): role is AccountRole {
  return role === 'buyer' || role === 'seller' || role === 'admin';
}

export async function authenticatedUser(
  request: VercelRequest,
  response: VercelResponse,
  supabase: SupabaseClient,
): Promise<User | null> {
  const token = bearerToken(request);
  if (!token) {
    sendJson(response, 401, { error: 'Silakan masuk terlebih dahulu.' });
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    sendJson(response, 401, { error: 'Sesi tidak valid atau sudah berakhir.' });
    return null;
  }

  return data.user;
}

export async function requireRole(
  request: VercelRequest,
  response: VercelResponse,
  supabase: SupabaseClient,
  allowedRoles: AccountRole[],
): Promise<{ user: User; role: AccountRole; roles: AccountRole[] } | null> {
  const user = await authenticatedUser(request, response, supabase);
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Unable to read account role:', error.message);
    sendJson(response, 500, { error: 'Role akun tidak dapat diverifikasi.' });
    return null;
  }

  if (!profile || !isAccountRole(profile.role)) {
    sendJson(response, 403, { error: 'Role akun tidak memiliki akses ke fitur ini.' });
    return null;
  }

  const roles: AccountRole[] = [profile.role];
  if (profile.role === 'admin' && user.email?.trim().toLowerCase() === dualRoleAdminEmail) {
    const { data: sellerProfile, error: sellerProfileError } = await supabase
      .from('seller_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (sellerProfileError) {
      console.error('Unable to verify seller access:', sellerProfileError.message);
      sendJson(response, 500, { error: 'Akses seller tidak dapat diverifikasi.' });
      return null;
    }

    if (sellerProfile) roles.push('seller');
  }

  const role = allowedRoles.find((allowedRole) => roles.includes(allowedRole));
  if (!role) {
    sendJson(response, 403, { error: 'Role akun tidak memiliki akses ke fitur ini.' });
    return null;
  }

  return { user, role, roles };
}
