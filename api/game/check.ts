import '../../lib/backend/load-local-env.js';
import { requireRole } from '../../lib/backend/auth.js';
import { isRecord, requestBody, sendJson, type VercelRequest, type VercelResponse } from '../../lib/backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../../lib/backend/supabase.js';

const accountNameCache = new Map<string, string>();
const maxAccountNameCacheEntries = 200;

function enkaNickname(value: unknown): string | null {
  if (!isRecord(value)) return null;

  const profiles: unknown[] = [value.playerInfo, value.detailInfo];
  if (isRecord(value.data)) profiles.push(value.data.playerInfo, value.data.detailInfo);

  for (const profile of profiles) {
    if (isRecord(profile) && typeof profile.nickname === 'string' && profile.nickname.trim()) {
      return profile.nickname.trim();
    }
  }
  return null;
}

function rememberAccountName(key: string, accountName: string): void {
  accountNameCache.set(key, accountName);
  if (accountNameCache.size > maxAccountNameCacheEntries) {
    const oldestKey = accountNameCache.keys().next().value;
    if (oldestKey) accountNameCache.delete(oldestKey);
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  response.setHeader('Cache-Control', 'no-store');

  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Backend autentikasi belum dikonfigurasi.' });
    return;
  }

  const account = await requireRole(request, response, createAdminClient(), ['buyer', 'seller', 'admin']);
  if (!account) return;

  const body = requestBody(request);
  if (!body) {
    sendJson(response, 400, { error: 'Data pengecekan ID tidak valid.' });
    return;
  }

  const game = typeof body.game === 'string' ? body.game.trim() : '';
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  const zone = typeof body.zone === 'string' ? body.zone.trim() : '';
  if (!['roblox', 'genshin', 'hsr', 'ml', 'ff', 'wuwa'].includes(game)) {
    sendJson(response, 400, { error: 'Game atau ID akun tidak valid.' });
    return;
  }

  if (game === 'wuwa') {
    sendJson(response, 409, {
      error: 'Pengecekan nickname otomatis Wuthering Waves belum tersedia. Pastikan nickname langsung di dalam game.',
    });
    return;
  }

  if (game === 'roblox') {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(userId)) {
      sendJson(response, 400, { error: 'Username Roblox harus 3–20 karakter dan hanya memakai huruf, angka, atau garis bawah.' });
      return;
    }

    let robloxResponse: Response;
    try {
      robloxResponse = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [userId], excludeBannedUsers: false }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      console.error('Roblox username lookup failed:', error instanceof Error ? error.message : 'Unknown network error');
      sendJson(response, 502, { error: 'Layanan verifikasi Roblox tidak dapat dihubungi.' });
      return;
    }

    let robloxResult: unknown;
    try {
      robloxResult = await robloxResponse.json();
    } catch {
      console.error('Roblox username lookup returned unreadable JSON:', robloxResponse.status);
      sendJson(response, 502, { error: 'Respons layanan verifikasi Roblox tidak valid.' });
      return;
    }

    if (!robloxResponse.ok) {
      if (robloxResponse.status === 429) {
        sendJson(response, 429, { error: 'Layanan Roblox sedang membatasi pengecekan. Coba lagi nanti.' });
        return;
      }
      console.error('Roblox username lookup failed with HTTP status:', robloxResponse.status);
      sendJson(response, 502, { error: 'Layanan verifikasi Roblox sedang tidak tersedia.' });
      return;
    }

    const accounts = isRecord(robloxResult) && Array.isArray(robloxResult.data)
      ? robloxResult.data
      : [];
    const matchingAccount = accounts.find(isRecord);
    if (!matchingAccount) {
      sendJson(response, 404, { error: 'Username Roblox tidak ditemukan.' });
      return;
    }

    const accountName = typeof matchingAccount.displayName === 'string'
      ? matchingAccount.displayName.trim()
      : typeof matchingAccount.name === 'string'
        ? matchingAccount.name.trim()
        : '';
    if (!accountName) {
      sendJson(response, 502, { error: 'Respons layanan Roblox tidak menyertakan nama akun.' });
      return;
    }

    sendJson(response, 200, { accountName });
    return;
  }

  if (!/^\d{6,12}$/.test(userId)) {
    sendJson(response, 400, { error: 'UID game harus berupa 6–12 angka.' });
    return;
  }

  if (game === 'ml' && !/^\d{2,6}$/.test(zone)) {
    sendJson(response, 400, { error: 'Zone ID Mobile Legends harus berupa 2–6 angka.' });
    return;
  }

  const cacheKey = `${game}:${userId}:${game === 'ml' ? zone : ''}`;
  const cachedResult = accountNameCache.get(cacheKey);
  if (cachedResult) {
    sendJson(response, 200, { accountName: cachedResult });
    return;
  }

  if (game === 'ml' || game === 'ff') {
    const providerUrl = `https://api.isan.eu.org/nickname/${game}`;
    const providerOptions: RequestInit = {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(game === 'ml' ? { id: userId, server: zone } : { id: userId }),
      signal: AbortSignal.timeout(10000),
    };

    let providerResponse: Response;
    try {
      providerResponse = await fetch(providerUrl, providerOptions);
    } catch (error) {
      console.error(`${game} account lookup failed:`, error instanceof Error ? error.message : 'Unknown network error');
      sendJson(response, 502, {
        error: game === 'ml'
          ? 'Layanan verifikasi Mobile Legends tidak dapat dihubungi.'
          : 'Layanan verifikasi Free Fire tidak dapat dihubungi.',
      });
      return;
    }

    let providerResult: unknown;
    try {
      providerResult = await providerResponse.json();
    } catch {
      console.error(`${game} account lookup returned unreadable JSON:`, providerResponse.status);
      sendJson(response, 502, { error: 'Respons layanan verifikasi akun game tidak valid.' });
      return;
    }

    if (!providerResponse.ok) {
      if (providerResponse.status === 404) {
        sendJson(response, 404, { error: 'ID game tidak ditemukan. Periksa kembali ID dan server.' });
        return;
      }
      if (providerResponse.status === 429) {
        sendJson(response, 429, { error: 'Layanan verifikasi sedang membatasi permintaan. Coba lagi nanti.' });
        return;
      }
      console.error(`${game} account lookup failed with HTTP status:`, providerResponse.status);
      sendJson(response, 502, { error: 'Layanan verifikasi akun game sedang tidak tersedia.' });
      return;
    }

    let accountName = '';
    if (isRecord(providerResult) && providerResult.success === true && typeof providerResult.name === 'string') {
      accountName = providerResult.name.trim();
    } else if (isRecord(providerResult) && providerResult.success === false) {
      sendJson(response, 404, {
        error: game === 'ml'
          ? 'User ID atau Zone ID Mobile Legends tidak ditemukan.'
          : 'Player ID Free Fire tidak ditemukan.',
      });
      return;
    }

    if (!accountName) {
      console.error(`${game} account lookup returned no account name.`);
      sendJson(response, 502, { error: 'Respons layanan verifikasi tidak menyertakan nama akun.' });
      return;
    }

    rememberAccountName(cacheKey, accountName);
    sendJson(response, 200, { accountName });
    return;
  }

  const enkaPath = game === 'genshin'
    ? `/api/uid/${encodeURIComponent(userId)}/?info`
    : `/api/hsr/uid/${encodeURIComponent(userId)}`;

  let enkaResponse: Response;
  try {
    enkaResponse = await fetch(`https://enka.network${enkaPath}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Kurostore/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error('Enka account lookup failed:', error instanceof Error ? error.message : 'Unknown network error');
    sendJson(response, 502, { error: 'Layanan verifikasi akun game tidak dapat dihubungi.' });
    return;
  }

  let enkaResult: unknown;
  try {
    enkaResult = await enkaResponse.json();
  } catch {
    console.error('Enka account lookup returned unreadable JSON:', enkaResponse.status);
    sendJson(response, 502, { error: 'Respons layanan verifikasi akun game tidak valid.' });
    return;
  }

  if (!enkaResponse.ok) {
    if (enkaResponse.status === 404) {
      sendJson(response, 404, { error: 'UID tidak ditemukan atau profil game tidak tersedia secara publik.' });
      return;
    }
    if (enkaResponse.status === 400) {
      sendJson(response, 400, { error: 'Format UID tidak valid untuk game ini.' });
      return;
    }
    if (enkaResponse.status === 429) {
      sendJson(response, 429, { error: 'Layanan verifikasi sedang membatasi permintaan. Coba lagi nanti.' });
      return;
    }
    console.error('Enka account lookup failed with HTTP status:', enkaResponse.status);
    sendJson(response, 502, { error: 'Profil akun tidak dapat dimuat saat ini.' });
    return;
  }

  const accountName = enkaNickname(enkaResult);
  if (!accountName) {
    sendJson(response, 404, { error: 'Nama akun tidak tersedia. Pastikan profil game terlihat publik.' });
    return;
  }

  rememberAccountName(cacheKey, accountName);
  sendJson(response, 200, { accountName });
}
